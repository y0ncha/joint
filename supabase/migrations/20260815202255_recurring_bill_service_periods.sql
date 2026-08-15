alter table public.recurring_transaction_schedules
  add column service_period_start date,
  add column service_period_end date,
  add constraint recurring_transaction_schedules_service_period_pair_check
    check (num_nonnulls(service_period_start, service_period_end) in (0, 2)),
  add constraint recurring_transaction_schedules_service_period_order_check
    check (service_period_start is null or service_period_start <= service_period_end),
  add constraint recurring_transaction_schedules_service_period_length_check
    check (service_period_start is null or service_period_end - service_period_start <= 365);

update public.recurring_transaction_schedules as schedule
set service_period_start = template.service_period_start,
    service_period_end = template.service_period_end
from lateral (
  select transaction.service_period_start, transaction.service_period_end
  from public.transactions as transaction
  where (transaction.recurring_schedule_id = schedule.id or transaction.id = schedule.first_occurrence_transaction_id)
    and transaction.service_period_start is not null
  order by (transaction.id = schedule.first_occurrence_transaction_id) desc, transaction.scheduled_for nulls last, transaction.created_at
  limit 1
) as template;

create or replace function private.recurring_occurrence_date_with_offset(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  occurrence_offset integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  target_month_offset integer;
  target_year integer;
  target_month integer;
  target_first_day date;
begin
  if cadence in ('weekly', 'custom_weekly') then
    return anchor_date + (7 * interval_count * occurrence_offset);
  end if;

  target_month_offset := extract(month from anchor_date)::integer - 1 + interval_count * occurrence_offset;
  target_year := extract(year from anchor_date)::integer + floor(target_month_offset / 12.0)::integer;
  target_month := target_month_offset - floor(target_month_offset / 12.0)::integer * 12 + 1;
  target_first_day := make_date(target_year, target_month, 1);
  return make_date(
    target_year,
    target_month,
    least(extract(day from anchor_date)::integer, extract(day from (target_first_day + interval '1 month - 1 day'))::integer)
  );
end;
$$;

create or replace function private.recurring_occurrence_index(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  occurrence_date date
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare candidate integer;
begin
  if cadence in ('weekly', 'custom_weekly') then
    if (occurrence_date - anchor_date) % (7 * interval_count) <> 0 then
      raise exception 'Transaction does not belong to this recurring schedule';
    end if;
    candidate := (occurrence_date - anchor_date) / (7 * interval_count);
  else
    candidate := ((extract(year from occurrence_date)::integer - extract(year from anchor_date)::integer) * 12
      + extract(month from occurrence_date)::integer - extract(month from anchor_date)::integer) / interval_count;
  end if;

  if candidate < 0 or private.recurring_occurrence_date(anchor_date, cadence, interval_count, candidate) <> occurrence_date then
    raise exception 'Transaction does not belong to this recurring schedule';
  end if;
  return candidate;
end;
$$;

create or replace function private.validate_recurring_schedule_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  destination_kind public.category_kind;
  destination_system_key text;
  destination_archived_at timestamptz;
begin
  if not new.enabled then
    if new.category_id is null and new.subcategory_id is null then
      new.paused_reason := coalesce(new.paused_reason, 'Schedule paused because its saved category is no longer available.');
    end if;
    return new;
  end if;

  if new.category_id is null and new.subcategory_id is null then
    new.enabled := false;
    new.paused_reason := coalesce(new.paused_reason, 'Schedule paused because its saved category is no longer available.');
    return new;
  end if;

  if new.paid_by is not null and not exists (
    select 1 from public.household_members where household_id = new.household_id and user_id = new.paid_by
  ) then
    raise exception 'Schedule payer must be a household member';
  end if;

  if new.category_id is not null then
    select kind, system_key, archived_at into destination_kind, destination_system_key, destination_archived_at
    from public.categories where household_id = new.household_id and id = new.category_id;
    if destination_kind is null
      or destination_kind::text is distinct from new.kind::text
      or destination_archived_at is not null
      or destination_system_key is distinct from (case new.kind when 'income' then 'other_income' else 'other_expense' end)
    then
      raise exception 'Schedule category must be an active matching Other category';
    end if;
  else
    select category.kind, category.system_key, greatest(subcategory.archived_at, category.archived_at)
    into destination_kind, destination_system_key, destination_archived_at
    from public.subcategories as subcategory
    join public.categories as category on category.id = subcategory.category_id
    where subcategory.household_id = new.household_id and subcategory.id = new.subcategory_id;
    if destination_kind is null or destination_kind::text is distinct from new.kind::text or destination_archived_at is not null then
      raise exception 'Schedule subcategory must be active and match the transaction kind';
    end if;
  end if;

  if destination_system_key = 'bills' and (new.service_period_start is null or new.service_period_end is null) then
    raise exception 'Bills schedules require a service period';
  end if;
  if destination_system_key is distinct from 'bills' and new.service_period_start is not null then
    raise exception 'Only Bills schedules can have a service period';
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_transaction_schedules_validate_destination on public.recurring_transaction_schedules;
create trigger recurring_transaction_schedules_validate_destination
before insert or update of household_id, paid_by, kind, category_id, subcategory_id, enabled, paused_reason, service_period_start, service_period_end
on public.recurring_transaction_schedules
for each row execute function private.validate_recurring_schedule_destination();

create or replace function private.create_recurring_transaction_schedule(
  target_household_id uuid,
  target_paid_by uuid,
  target_kind public.transaction_kind,
  target_amount numeric,
  target_occurred_on date,
  target_merchant text,
  target_note text,
  target_category_id uuid,
  target_subcategory_id uuid,
  target_service_period_start date,
  target_service_period_end date,
  target_cadence public.recurring_schedule_cadence,
  target_interval_count integer,
  create_initial_occurrence boolean,
  target_first_occurrence_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_id uuid;
  existing_transaction public.transactions%rowtype;
begin
  if not private.is_household_member(target_household_id) then raise exception 'Not a household member'; end if;
  perform private.recurring_occurrence_after(target_occurred_on, target_cadence, target_interval_count, current_date);

  if target_first_occurrence_transaction_id is not null then
    select * into existing_transaction from public.transactions
    where id = target_first_occurrence_transaction_id and household_id = target_household_id for update;
    if not found
      or existing_transaction.kind is distinct from target_kind
      or existing_transaction.amount is distinct from target_amount
      or existing_transaction.occurred_on is distinct from target_occurred_on
      or lower(btrim(existing_transaction.merchant)) is distinct from lower(btrim(target_merchant)) then
      raise exception 'Existing transaction must match the duplicate';
    end if;
  end if;

  insert into public.recurring_transaction_schedules (
    household_id, created_by, paid_by, kind, amount, merchant, note, category_id, subcategory_id,
    anchor_date, cadence, interval_count, next_occurs_on, first_occurrence_transaction_id, service_period_start, service_period_end
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount, target_merchant, target_note, target_category_id, target_subcategory_id,
    target_occurred_on, target_cadence, target_interval_count,
    private.recurring_occurrence_date(target_occurred_on, target_cadence, target_interval_count, 1), target_first_occurrence_transaction_id,
    target_service_period_start, target_service_period_end
  ) on conflict (first_occurrence_transaction_id) do update
    set first_occurrence_transaction_id = excluded.first_occurrence_transaction_id
  returning id into schedule_id;

  if create_initial_occurrence then
    insert into public.transactions (
      household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note, category_id, subcategory_id,
      service_period_start, service_period_end, recurring_schedule_id, scheduled_for
    ) values (
      target_household_id, auth.uid(), target_paid_by, target_kind, target_amount, target_occurred_on, target_merchant, target_note, target_category_id, target_subcategory_id,
      target_service_period_start, target_service_period_end, schedule_id, target_occurred_on
    );
  end if;
  return schedule_id;
end;
$$;

create or replace function public.process_due_recurring_transaction_schedules(target_today date default current_date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  schedule public.recurring_transaction_schedules%rowtype;
  occurrence date;
  created_count integer := 0;
  catch_up_count integer;
  error_message text;
begin
  for schedule in
    select * from public.recurring_transaction_schedules
    where enabled and next_occurs_on <= target_today order by next_occurs_on for update skip locked
  loop
    begin
      perform private.recurring_occurrence_after_from(schedule.anchor_date, schedule.cadence, schedule.interval_count, target_today, schedule.next_occurrence_index);
      catch_up_count := 0;
      while schedule.next_occurs_on <= target_today loop
        catch_up_count := catch_up_count + 1;
        if catch_up_count > 366 then raise exception 'Recurring schedule catch-up exceeds the maximum of 366 occurrences.'; end if;
        occurrence := schedule.next_occurs_on;
        insert into public.transactions (
          household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note, category_id, subcategory_id,
          service_period_start, service_period_end, recurring_schedule_id, scheduled_for
        ) values (
          schedule.household_id, schedule.created_by, schedule.paid_by, schedule.kind, schedule.amount, occurrence, schedule.merchant, schedule.note,
          schedule.category_id, schedule.subcategory_id,
          case when schedule.service_period_start is null then null else private.recurring_occurrence_date(schedule.service_period_start, schedule.cadence, schedule.interval_count, schedule.next_occurrence_index) end,
          case when schedule.service_period_end is null then null else private.recurring_occurrence_date(schedule.service_period_end, schedule.cadence, schedule.interval_count, schedule.next_occurrence_index) end,
          schedule.id, occurrence
        ) on conflict (recurring_schedule_id, scheduled_for) where recurring_schedule_id is not null do nothing;
        if found then created_count := created_count + 1; end if;
        update public.recurring_transaction_schedules
        set next_occurrence_index = schedule.next_occurrence_index + 1,
            next_occurs_on = private.recurring_occurrence_date(schedule.anchor_date, schedule.cadence, schedule.interval_count, schedule.next_occurrence_index + 1),
            paused_reason = null
        where id = schedule.id returning * into schedule;
      end loop;
    exception when others then
      get stacked diagnostics error_message = message_text;
      update public.recurring_transaction_schedules
      set enabled = false,
          paused_reason = case when error_message like 'Recurring schedule catch-up exceeds%' or error_message like 'Recurring interval_count must be between%' then error_message else 'Schedule paused because its saved category is no longer available.' end
      where id = schedule.id;
    end;
  end loop;
  return created_count;
end;
$$;

create function public.update_recurring_transaction_occurrence(
  target_transaction_id uuid,
  target_scope text,
  target_amount numeric,
  target_merchant text,
  target_note text,
  target_paid_by uuid,
  target_category_id uuid,
  target_subcategory_id uuid,
  target_service_period_start date,
  target_service_period_end date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence public.transactions%rowtype;
  schedule public.recurring_transaction_schedules%rowtype;
  occurrence_index integer;
  template_start date;
  template_end date;
begin
  if target_scope not in ('this', 'future', 'all') then raise exception 'Invalid recurring edit scope'; end if;
  select * into occurrence
  from public.transactions
  where id = target_transaction_id
  for update;
  select * into schedule
  from public.recurring_transaction_schedules
  where id = occurrence.recurring_schedule_id
  for update;
  if occurrence.id is null or schedule.id is null or not private.is_household_member(schedule.household_id) then raise exception 'Not a household member'; end if;

  occurrence_index := private.recurring_occurrence_index(schedule.anchor_date, schedule.cadence, schedule.interval_count, occurrence.scheduled_for);
  template_start := case when target_service_period_start is null then null else private.recurring_occurrence_date_with_offset(target_service_period_start, schedule.cadence, schedule.interval_count, -occurrence_index) end;
  template_end := case when target_service_period_end is null then null else private.recurring_occurrence_date_with_offset(target_service_period_end, schedule.cadence, schedule.interval_count, -occurrence_index) end;

  if target_scope in ('future', 'all') then
    update public.recurring_transaction_schedules
    set amount = target_amount, merchant = target_merchant, note = target_note, paid_by = target_paid_by,
        category_id = target_category_id, subcategory_id = target_subcategory_id,
        service_period_start = template_start, service_period_end = template_end
    where id = schedule.id;
  end if;

  if target_scope = 'this' then
    update public.transactions
    set amount = target_amount, merchant = target_merchant, note = target_note, paid_by = target_paid_by,
        category_id = target_category_id, subcategory_id = target_subcategory_id,
        service_period_start = target_service_period_start, service_period_end = target_service_period_end
    where id = occurrence.id;
  elsif target_scope = 'all' then
    update public.transactions as transaction
    set amount = target_amount, merchant = target_merchant, note = target_note, paid_by = target_paid_by,
        category_id = target_category_id, subcategory_id = target_subcategory_id,
        service_period_start = case when template_start is null then null else private.recurring_occurrence_date(template_start, schedule.cadence, schedule.interval_count, private.recurring_occurrence_index(schedule.anchor_date, schedule.cadence, schedule.interval_count, transaction.scheduled_for)) end,
        service_period_end = case when template_end is null then null else private.recurring_occurrence_date(template_end, schedule.cadence, schedule.interval_count, private.recurring_occurrence_index(schedule.anchor_date, schedule.cadence, schedule.interval_count, transaction.scheduled_for)) end
    where transaction.recurring_schedule_id = schedule.id;
  end if;
end;
$$;

revoke execute on function private.recurring_occurrence_date_with_offset(date, public.recurring_schedule_cadence, integer, integer) from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_index(date, public.recurring_schedule_cadence, integer, date) from public, anon, authenticated;
revoke execute on function public.update_recurring_transaction_occurrence(uuid, text, numeric, text, text, uuid, uuid, uuid, date, date) from public, anon;
grant execute on function public.update_recurring_transaction_occurrence(uuid, text, numeric, text, text, uuid, uuid, uuid, date, date) to authenticated;
