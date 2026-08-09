drop policy "Members can manage recurring schedules" on public.recurring_transaction_schedules;

create policy "Members can read recurring schedules"
on public.recurring_transaction_schedules
for select to authenticated
using (private.is_household_member(household_id));

revoke insert, update, delete on table public.recurring_transaction_schedules from anon, authenticated;
grant select on table public.recurring_transaction_schedules to authenticated;

alter table public.recurring_transaction_schedules
  drop constraint if exists recurring_transaction_schedules_household_id_category_id_fkey,
  drop constraint if exists recurring_transaction_schedule_household_id_subcategory_id_fkey,
  drop constraint if exists recurring_transaction_schedules_household_id_subcategory_id_fkey,
  drop constraint if exists recurring_transaction_schedules_check,
  add constraint recurring_transaction_schedules_household_id_category_id_fkey
    foreign key (household_id, category_id)
    references public.categories(household_id, id)
    on delete set null (category_id),
  add constraint recurring_transaction_schedules_household_id_subcategory_id_fkey
    foreign key (household_id, subcategory_id)
    references public.subcategories(household_id, id)
    on delete set null (subcategory_id),
  add constraint recurring_transaction_schedules_destination_check
    check (num_nonnulls(category_id, subcategory_id) = 1 or (not enabled and paused_reason is not null));

alter table public.recurring_transaction_schedules
  add column first_occurrence_transaction_id uuid unique references public.transactions(id) on delete set null;

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
    select 1 from public.household_members
    where household_id = new.household_id and user_id = new.paid_by
  ) then
    raise exception 'Schedule payer must be a household member';
  end if;

  if new.category_id is not null then
    select kind, system_key, archived_at
    into destination_kind, destination_system_key, destination_archived_at
    from public.categories
    where household_id = new.household_id and id = new.category_id;

    if destination_kind is null
      or destination_kind is distinct from new.kind
      or destination_archived_at is not null
      or destination_system_key is distinct from (case new.kind when 'income' then 'other_income' else 'other_expense' end)
    then
      raise exception 'Schedule category must be an active matching Other category';
    end if;
  else
    select category.kind, greatest(subcategory.archived_at, category.archived_at)
    into destination_kind, destination_archived_at
    from public.subcategories as subcategory
    join public.categories as category on category.id = subcategory.category_id
    where subcategory.household_id = new.household_id and subcategory.id = new.subcategory_id;

    if destination_kind is null or destination_kind is distinct from new.kind or destination_archived_at is not null then
      raise exception 'Schedule subcategory must be active and match the transaction kind';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists recurring_transaction_schedules_validate_destination on public.recurring_transaction_schedules;
create trigger recurring_transaction_schedules_validate_destination
before insert or update of household_id, paid_by, kind, category_id, subcategory_id, enabled, paused_reason
on public.recurring_transaction_schedules
for each row execute function private.validate_recurring_schedule_destination();

create or replace function private.recurring_occurrence_after(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  target_date date
)
returns table(occurrence_index integer, occurs_on date)
language plpgsql
immutable
set search_path = ''
as $$
begin
  occurrence_index := 1;
  loop
    occurs_on := private.recurring_occurrence_date(anchor_date, cadence, interval_count, occurrence_index);
    exit when occurs_on > target_date;
    occurrence_index := occurrence_index + 1;
  end loop;
  return next;
end;
$$;

drop function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer);
drop function if exists private.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, boolean);

create function private.create_recurring_transaction_schedule(
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
  target_interval_count integer
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

create function public.create_recurring_transaction_schedule_after_duplicate(
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
  target_existing_transaction_id uuid
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

create function public.update_recurring_transaction_schedule(
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

create function public.set_recurring_transaction_schedule_enabled(target_schedule_id uuid, target_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare schedule public.recurring_transaction_schedules%rowtype;
begin
  select * into schedule from public.recurring_transaction_schedules where id = target_schedule_id for update;
  if schedule.id is null or not private.is_household_member(schedule.household_id) then raise exception 'Not a household member'; end if;
  update public.recurring_transaction_schedules
  set enabled = target_enabled,
      paused_reason = case when target_enabled then null else 'Paused by a household member.' end
  where id = schedule.id;
end;
$$;

create function public.delete_recurring_transaction_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare schedule public.recurring_transaction_schedules%rowtype;
begin
  select * into schedule from public.recurring_transaction_schedules where id = target_schedule_id for update;
  if schedule.id is null or not private.is_household_member(schedule.household_id) then raise exception 'Not a household member'; end if;
  delete from public.recurring_transaction_schedules where id = schedule.id;
end;
$$;

revoke execute on function private.validate_recurring_schedule_destination() from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_after(date, public.recurring_schedule_cadence, integer, date) from public, anon, authenticated;
revoke execute on function private.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) from public, anon;
revoke execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.set_recurring_transaction_schedule_enabled(uuid, boolean) from public, anon;
revoke execute on function public.delete_recurring_transaction_schedule(uuid) from public, anon;
grant execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) to authenticated;
grant execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.set_recurring_transaction_schedule_enabled(uuid, boolean) to authenticated;
grant execute on function public.delete_recurring_transaction_schedule(uuid) to authenticated;
