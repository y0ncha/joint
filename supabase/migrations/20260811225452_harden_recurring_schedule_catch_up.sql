create or replace function private.validate_recurring_schedule_limits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.interval_count not between 1 and 365 then
    raise exception 'Recurring interval_count must be between 1 and 365.';
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_transaction_schedules_validate_limits on public.recurring_transaction_schedules;
create trigger recurring_transaction_schedules_validate_limits
before insert or update of interval_count on public.recurring_transaction_schedules
for each row execute function private.validate_recurring_schedule_limits();

create or replace function private.recurring_occurrence_after_from(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  target_date date,
  starting_index integer
)
returns table(occurrence_index integer, occurs_on date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  due_count integer := 0;
begin
  if interval_count not between 1 and 365 then
    raise exception 'Recurring interval_count must be between 1 and 365.';
  end if;
  if starting_index < 1 then
    raise exception 'Recurring occurrence index must be positive.';
  end if;

  occurrence_index := starting_index;
  loop
    occurs_on := private.recurring_occurrence_date(anchor_date, cadence, interval_count, occurrence_index);
    exit when occurs_on > target_date;
    if due_count >= 366 then
      raise exception 'Recurring schedule catch-up exceeds the maximum of 366 occurrences.';
    end if;
    due_count := due_count + 1;
    occurrence_index := occurrence_index + 1;
  end loop;
  return next;
end;
$$;

create or replace function private.recurring_occurrence_after(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  target_date date
)
returns table(occurrence_index integer, occurs_on date)
language sql
immutable
set search_path = ''
as $$
  select *
  from private.recurring_occurrence_after_from(anchor_date, cadence, interval_count, target_date, 1);
$$;

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
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;

  perform private.recurring_occurrence_after(target_occurred_on, target_cadence, target_interval_count, current_date);

  if target_first_occurrence_transaction_id is not null then
    select * into existing_transaction
    from public.transactions
    where id = target_first_occurrence_transaction_id and household_id = target_household_id
    for update;

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
    anchor_date, cadence, interval_count, next_occurs_on, first_occurrence_transaction_id
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount, target_merchant, target_note, target_category_id, target_subcategory_id,
    target_occurred_on, target_cadence, target_interval_count,
    private.recurring_occurrence_date(target_occurred_on, target_cadence, target_interval_count, 1), target_first_occurrence_transaction_id
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

create or replace function public.create_recurring_transaction_schedule(
  target_household_id uuid,
  target_paid_by uuid default null,
  target_kind public.transaction_kind default null,
  target_amount numeric default null,
  target_occurred_on date default null,
  target_merchant text default null,
  target_note text default null,
  target_category_id uuid default null,
  target_subcategory_id uuid default null,
  target_service_period_start date default null,
  target_service_period_end date default null,
  target_cadence public.recurring_schedule_cadence default null,
  target_interval_count integer default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.create_recurring_transaction_schedule(
    target_household_id, target_paid_by, target_kind, target_amount, target_occurred_on, target_merchant, target_note,
    target_category_id, target_subcategory_id, target_service_period_start, target_service_period_end, target_cadence, target_interval_count, true, null
  );
$$;

create or replace function public.create_recurring_transaction_schedule_after_duplicate(
  target_household_id uuid,
  target_paid_by uuid default null,
  target_kind public.transaction_kind default null,
  target_amount numeric default null,
  target_occurred_on date default null,
  target_merchant text default null,
  target_note text default null,
  target_category_id uuid default null,
  target_subcategory_id uuid default null,
  target_service_period_start date default null,
  target_service_period_end date default null,
  target_cadence public.recurring_schedule_cadence default null,
  target_interval_count integer default null,
  target_existing_transaction_id uuid default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.create_recurring_transaction_schedule(
    target_household_id, target_paid_by, target_kind, target_amount, target_occurred_on, target_merchant, target_note,
    target_category_id, target_subcategory_id, target_service_period_start, target_service_period_end, target_cadence, target_interval_count, false,
    target_existing_transaction_id
  );
$$;

create or replace function public.update_recurring_transaction_schedule(
  target_schedule_id uuid,
  target_amount numeric,
  target_merchant text,
  target_note text,
  target_cadence public.recurring_schedule_cadence,
  target_interval_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.recurring_transaction_schedules%rowtype;
  next_occurrence record;
begin
  select * into schedule
  from public.recurring_transaction_schedules
  where id = target_schedule_id
  for update;

  if schedule.id is null or not private.is_household_member(schedule.household_id) then
    raise exception 'Not a household member';
  end if;

  select * into next_occurrence
  from private.recurring_occurrence_after(schedule.anchor_date, target_cadence, target_interval_count, current_date);

  update public.recurring_transaction_schedules
  set amount = target_amount,
      merchant = target_merchant,
      note = target_note,
      cadence = target_cadence,
      interval_count = target_interval_count,
      next_occurrence_index = next_occurrence.occurrence_index,
      next_occurs_on = next_occurrence.occurs_on
  where id = schedule.id;
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
  is_bills boolean;
  created_count integer := 0;
  catch_up_count integer;
  error_message text;
begin
  for schedule in
    select * from public.recurring_transaction_schedules
    where enabled and next_occurs_on <= target_today
    order by next_occurs_on
    for update skip locked
  loop
    begin
      perform private.recurring_occurrence_after_from(
        schedule.anchor_date,
        schedule.cadence,
        schedule.interval_count,
        target_today,
        schedule.next_occurrence_index
      );

      catch_up_count := 0;
      while schedule.next_occurs_on <= target_today loop
        catch_up_count := catch_up_count + 1;
        if catch_up_count > 366 then
          raise exception 'Recurring schedule catch-up exceeds the maximum of 366 occurrences.';
        end if;

        occurrence := schedule.next_occurs_on;
        select coalesce(categories.system_key = 'bills', false)
        into is_bills
        from public.subcategories
        join public.categories on categories.id = subcategories.category_id
        where subcategories.id = schedule.subcategory_id;

        insert into public.transactions (
          household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note, category_id, subcategory_id,
          service_period_start, service_period_end, recurring_schedule_id, scheduled_for
        ) values (
          schedule.household_id, schedule.created_by, schedule.paid_by, schedule.kind, schedule.amount, occurrence, schedule.merchant, schedule.note,
          schedule.category_id, schedule.subcategory_id,
          case when is_bills then date_trunc('month', occurrence)::date else null end,
          case when is_bills then (date_trunc('month', occurrence) + interval '1 month - 1 day')::date else null end,
          schedule.id, occurrence
        ) on conflict (recurring_schedule_id, scheduled_for) where recurring_schedule_id is not null do nothing;
        if found then created_count := created_count + 1; end if;

        update public.recurring_transaction_schedules
        set next_occurrence_index = schedule.next_occurrence_index + 1,
            next_occurs_on = private.recurring_occurrence_date(
              schedule.anchor_date, schedule.cadence, schedule.interval_count, schedule.next_occurrence_index + 1
            ),
            paused_reason = null
        where id = schedule.id
        returning * into schedule;
      end loop;
    exception when others then
      get stacked diagnostics error_message = message_text;
      update public.recurring_transaction_schedules
      set enabled = false,
          paused_reason = case
            when error_message like 'Recurring schedule catch-up exceeds%'
              or error_message like 'Recurring interval_count must be between%'
            then error_message
            else 'Schedule paused because its saved category is no longer available.'
          end
      where id = schedule.id;
    end;
  end loop;
  return created_count;
end;
$$;

revoke execute on function private.validate_recurring_schedule_limits() from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_after_from(date, public.recurring_schedule_cadence, integer, date, integer) from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_after(date, public.recurring_schedule_cadence, integer, date) from public, anon, authenticated;
revoke execute on function private.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) from public, anon;
revoke execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.process_due_recurring_transaction_schedules(date) from public, anon, authenticated;
grant execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) to authenticated;
grant execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.process_due_recurring_transaction_schedules(date) to service_role;
