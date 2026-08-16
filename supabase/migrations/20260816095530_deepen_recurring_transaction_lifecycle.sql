begin;

lock table public.recurring_transaction_schedules, public.transactions in share row exclusive mode;

do $$
declare
  schedule public.recurring_transaction_schedules%rowtype;
  occurrence public.transactions%rowtype;
begin
  for schedule in
    select *
    from public.recurring_transaction_schedules
    where first_occurrence_transaction_id is not null
    order by id
    for update
  loop
    select *
    into occurrence
    from public.transactions
    where id = schedule.first_occurrence_transaction_id
    for update;

    if not found then
      raise exception 'Recurring schedule % points to a missing first occurrence', schedule.id;
    end if;
    if occurrence.household_id is distinct from schedule.household_id
      or occurrence.source is distinct from 'manual'::public.transaction_source
      or (occurrence.recurring_schedule_id is not null and occurrence.recurring_schedule_id <> schedule.id)
      or (occurrence.scheduled_for is not null and occurrence.scheduled_for <> schedule.anchor_date)
    then
      raise exception 'Recurring schedule % has an invalid first occurrence', schedule.id;
    end if;
    if exists (
      select 1
      from public.transactions as other_occurrence
      where other_occurrence.recurring_schedule_id = schedule.id
        and other_occurrence.scheduled_for = schedule.anchor_date
        and other_occurrence.id <> occurrence.id
    ) then
      raise exception 'Recurring schedule % has a duplicate anchor occurrence', schedule.id;
    end if;

    update public.transactions
    set recurring_schedule_id = schedule.id,
        scheduled_for = schedule.anchor_date
    where id = occurrence.id;
  end loop;
end;
$$;

alter table public.recurring_transaction_schedules
  drop constraint if exists recurring_transaction_schedules_first_occurrence_transaction_id_fkey,
  drop constraint if exists recurring_transaction_schedules_first_occurrence_transaction_id_key,
  drop column if exists first_occurrence_transaction_id;

alter table public.recurring_transaction_schedules
  add constraint recurring_transaction_schedules_household_id_id_key unique (household_id, id);

alter table public.transactions
  drop constraint if exists transactions_recurring_schedule_id_fkey,
  add constraint transactions_recurring_schedule_id_fkey
    foreign key (household_id, recurring_schedule_id)
    references public.recurring_transaction_schedules (household_id, id)
    on delete restrict,
  add constraint transactions_recurring_metadata_pair_check
    check ((recurring_schedule_id is null) = (scheduled_for is null)),
  add constraint transactions_recurring_schedule_source_check
    check (recurring_schedule_id is null or source = 'manual'::public.transaction_source);

drop index if exists public.recurring_transaction_schedules_due_idx;

alter table public.recurring_transaction_schedules
  drop constraint if exists recurring_transaction_schedules_destination_check;

alter table public.recurring_transaction_schedules
  rename column paused_reason to status_reason;

create type public.recurring_schedule_status as enum ('active', 'paused', 'stopped', 'blocked');

alter table public.recurring_transaction_schedules
  add column status public.recurring_schedule_status not null default 'active';

update public.recurring_transaction_schedules
set status = case when enabled then 'active'::public.recurring_schedule_status else 'paused'::public.recurring_schedule_status end;

drop trigger if exists recurring_transaction_schedules_validate_destination
on public.recurring_transaction_schedules;

alter table public.recurring_transaction_schedules
  drop column enabled,
  add column enabled boolean generated always as (status = 'active'::public.recurring_schedule_status) stored,
  add constraint recurring_transaction_schedules_destination_check
    check (num_nonnulls(category_id, subcategory_id) <= 1);

create index recurring_transaction_schedules_due_idx
on public.recurring_transaction_schedules (next_occurs_on)
where status = 'active'::public.recurring_schedule_status;

create index recurring_transaction_schedules_category_fk_idx
on public.recurring_transaction_schedules (household_id, category_id)
where category_id is not null;

create index recurring_transaction_schedules_subcategory_fk_idx
on public.recurring_transaction_schedules (household_id, subcategory_id)
where subcategory_id is not null;

create table public.recurring_transaction_schedule_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status public.recurring_schedule_status not null,
  new_status public.recurring_schedule_status not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint recurring_transaction_schedule_events_schedule_fkey
    foreign key (household_id, schedule_id)
    references public.recurring_transaction_schedules (household_id, id)
    on delete restrict,
  constraint recurring_transaction_schedule_events_status_change_check
    check (previous_status is distinct from new_status)
);

create index recurring_transaction_schedule_events_schedule_idx
on public.recurring_transaction_schedule_events (schedule_id, created_at desc);

create index recurring_transaction_schedule_events_household_idx
on public.recurring_transaction_schedule_events (household_id, created_at desc);

alter table public.recurring_transaction_schedule_events enable row level security;
revoke all on table public.recurring_transaction_schedule_events from public, anon, authenticated;
grant select on table public.recurring_transaction_schedule_events to authenticated;

create policy "Members can read recurring schedule events"
on public.recurring_transaction_schedule_events
for select to authenticated
using (private.is_household_member(household_id));

revoke insert, update, delete on table public.recurring_transaction_schedules from public, anon, authenticated;
grant select on table public.recurring_transaction_schedules to authenticated;

create or replace function private.recurring_occurrence_date_with_offset(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  occurrence_offset integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select private.recurring_occurrence_date(
    anchor_date,
    cadence,
    interval_count,
    occurrence_offset
  );
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
declare
  candidate integer;
begin
  if interval_count not between 1 and 365 then
    raise exception 'Recurring interval_count must be between 1 and 365.';
  end if;

  if cadence in ('weekly', 'custom_weekly') then
    if (occurrence_date - anchor_date) % (7 * interval_count) <> 0 then
      raise exception 'Transaction does not belong to this recurring schedule';
    end if;
    candidate := (occurrence_date - anchor_date) / (7 * interval_count);
  else
    candidate := (
      (extract(year from occurrence_date)::integer - extract(year from anchor_date)::integer) * 12
      + extract(month from occurrence_date)::integer
      - extract(month from anchor_date)::integer
    ) / interval_count;
  end if;

  if candidate < 0
    or private.recurring_occurrence_date(
      anchor_date,
      cadence,
      interval_count,
      candidate
    ) <> occurrence_date
  then
    raise exception 'Transaction does not belong to this recurring schedule';
  end if;
  return candidate;
end;
$$;

create or replace function private.recurring_destination_is_valid(
  target_household_id uuid,
  target_paid_by uuid,
  target_kind public.transaction_kind,
  target_category_id uuid,
  target_subcategory_id uuid,
  target_service_period_start date,
  target_service_period_end date
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  destination_kind public.category_kind;
  destination_system_key text;
  destination_archived_at timestamptz;
begin
  if target_kind not in ('income', 'expense')
    or num_nonnulls(target_category_id, target_subcategory_id) <> 1
    or (target_service_period_start is null) <> (target_service_period_end is null)
    or (target_service_period_start is not null and (
      target_service_period_start > target_service_period_end
      or target_service_period_end - target_service_period_start > 365
    ))
  then
    return false;
  end if;

  if target_paid_by is not null and not exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = target_paid_by
  ) then
    return false;
  end if;

  if target_category_id is not null then
    select category.kind, category.system_key, category.archived_at
    into destination_kind, destination_system_key, destination_archived_at
    from public.categories as category
    where category.household_id = target_household_id
      and category.id = target_category_id;
  else
    select category.kind,
           category.system_key,
           greatest(subcategory.archived_at, category.archived_at)
    into destination_kind, destination_system_key, destination_archived_at
    from public.subcategories as subcategory
    join public.categories as category
      on category.id = subcategory.category_id
     and category.household_id = subcategory.household_id
    where subcategory.household_id = target_household_id
      and subcategory.id = target_subcategory_id;
  end if;

  if destination_kind is null
    or destination_kind::text is distinct from target_kind::text
    or destination_archived_at is not null
  then
    return false;
  end if;

  if target_category_id is not null
    and destination_system_key is distinct from (
      case target_kind when 'income' then 'other_income' else 'other_expense' end
    )
  then
    return false;
  end if;

  if destination_system_key = 'bills'
    and (target_service_period_start is null or target_service_period_end is null)
  then
    return false;
  end if;
  if destination_system_key is distinct from 'bills'
    and target_service_period_start is not null
  then
    return false;
  end if;
  return true;
end;
$$;

create or replace function private.recurring_occurrence_destination_is_valid(
  target_household_id uuid,
  target_paid_by uuid,
  target_kind public.transaction_kind,
  target_category_id uuid,
  target_subcategory_id uuid,
  target_service_period_start date,
  target_service_period_end date
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  if target_category_id is not null then
    perform 1
    from public.categories as category
    where category.household_id = target_household_id
      and category.id = target_category_id
    for share;
  elsif target_subcategory_id is not null then
    perform 1
    from public.subcategories as subcategory
    join public.categories as category
      on category.id = subcategory.category_id
     and category.household_id = subcategory.household_id
    where subcategory.household_id = target_household_id
      and subcategory.id = target_subcategory_id
    for share of subcategory, category;
  end if;

  return private.recurring_destination_is_valid(
    target_household_id,
    target_paid_by,
    target_kind,
    target_category_id,
    target_subcategory_id,
    target_service_period_start,
    target_service_period_end
  );
end;
$$;

create or replace function private.validate_recurring_occurrence_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.recurring_schedule_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.category_id is null
    and new.subcategory_id is null
    and (old.category_id is not null or old.subcategory_id is not null)
  then
    return new;
  end if;
  if not private.recurring_occurrence_destination_is_valid(
    new.household_id,
    new.paid_by,
    new.kind,
    new.category_id,
    new.subcategory_id,
    new.service_period_start,
    new.service_period_end
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'recurring_destination: occurrence destination is unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_validate_recurring_destination on public.transactions;
create trigger transactions_validate_recurring_destination
before insert or update of household_id, paid_by, kind, category_id, subcategory_id,
  service_period_start, service_period_end, recurring_schedule_id
on public.transactions
for each row execute function private.validate_recurring_occurrence_destination();

create or replace function private.validate_recurring_schedule_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.category_id is null
    and new.subcategory_id is null
    and (old.category_id is not null or old.subcategory_id is not null)
  then
    return new;
  end if;

  if new.status not in (
    'blocked'::public.recurring_schedule_status,
    'stopped'::public.recurring_schedule_status
  )
    and not private.recurring_destination_is_valid(
      new.household_id,
      new.paid_by,
      new.kind,
      new.category_id,
      new.subcategory_id,
      new.service_period_start,
      new.service_period_end
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'recurring_destination: schedule destination is unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_transaction_schedules_validate_destination
on public.recurring_transaction_schedules;
create trigger recurring_transaction_schedules_validate_destination
before insert or update of household_id, paid_by, kind, category_id, subcategory_id,
  status, service_period_start, service_period_end
on public.recurring_transaction_schedules
for each row execute function private.validate_recurring_schedule_destination();

create or replace function private.transition_recurring_schedule_status(
  target_schedule_id uuid,
  target_status public.recurring_schedule_status,
  target_reason text default null,
  target_allow_block boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.recurring_transaction_schedules%rowtype;
  actor uuid := auth.uid();
  transition_reason text;
begin
  select *
  into schedule
  from public.recurring_transaction_schedules
  where id = target_schedule_id
  for update;

  if not found then
    raise exception 'Recurring schedule not found';
  end if;
  if actor is not null then
    if not private.is_household_member(schedule.household_id) then
      raise exception 'Not a household member';
    end if;
  elsif current_user not in ('postgres', 'service_role') then
    raise exception 'Only the recurring processor may use an internal transition';
  end if;
  if target_status = 'blocked'::public.recurring_schedule_status and not target_allow_block then
    raise exception 'Only the recurring processor may block a schedule';
  end if;
  if schedule.status = target_status then
    return;
  end if;
  if schedule.status = 'stopped'::public.recurring_schedule_status then
    raise exception 'Stopped recurring schedules are terminal';
  end if;
  if target_status = 'active'::public.recurring_schedule_status
    and schedule.status = 'blocked'::public.recurring_schedule_status
    and not private.recurring_destination_is_valid(
      schedule.household_id,
      schedule.paid_by,
      schedule.kind,
      schedule.category_id,
      schedule.subcategory_id,
      schedule.service_period_start,
      schedule.service_period_end
    )
  then
    raise exception 'Repair the recurring schedule destination before resuming';
  end if;
  if target_status = 'paused'::public.recurring_schedule_status
    and schedule.status <> 'active'::public.recurring_schedule_status
  then
    raise exception 'Invalid recurring schedule status transition';
  end if;
  if target_status = 'stopped'::public.recurring_schedule_status
    and schedule.status not in ('active', 'paused')
  then
    raise exception 'Invalid recurring schedule status transition';
  end if;
  if target_status = 'active'::public.recurring_schedule_status
    and schedule.status not in ('paused', 'blocked')
  then
    raise exception 'Invalid recurring schedule status transition';
  end if;

  transition_reason := case
    when target_reason is not null then target_reason
    when target_status = 'paused'::public.recurring_schedule_status then 'paused_by_member'
    when target_status = 'stopped'::public.recurring_schedule_status then 'stopped_by_member'
    else null
  end;

  update public.recurring_transaction_schedules
  set status = target_status,
      status_reason = transition_reason
  where id = schedule.id;

  insert into public.recurring_transaction_schedule_events (
    schedule_id, household_id, actor_id, previous_status, new_status, reason
  ) values (
    schedule.id, schedule.household_id,
    case when current_user in ('postgres', 'service_role') and actor is null then null else actor end,
    schedule.status, target_status, transition_reason
  );
end;
$$;

create or replace function private.recurring_schedule_destination_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_household_member(new.household_id) then
    raise exception 'Not a household member';
  end if;
  if new.status <> 'stopped'::public.recurring_schedule_status
    and not private.recurring_destination_is_valid(
      new.household_id,
      new.paid_by,
      new.kind,
      new.category_id,
      new.subcategory_id,
      new.service_period_start,
      new.service_period_end
    )
  then
    perform private.transition_recurring_schedule_status(
      new.id,
      'blocked'::public.recurring_schedule_status,
      'destination_unavailable',
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_transaction_schedules_block_invalid_destination
on public.recurring_transaction_schedules;
create trigger recurring_transaction_schedules_block_invalid_destination
after insert or update of household_id, paid_by, kind, category_id, subcategory_id,
  status, service_period_start, service_period_end
on public.recurring_transaction_schedules
for each row execute function private.recurring_schedule_destination_after_change();

create or replace function private.protect_recurring_transaction_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(pg_catalog.current_setting('joint.recurring_write', true), 'off') = 'on'
    and current_user = pg_catalog.pg_get_userbyid(
      (
        select proowner
        from pg_catalog.pg_proc
        where oid = 'private.protect_recurring_transaction_metadata()'::pg_catalog.regprocedure
      )
    )
    and pg_catalog.current_setting('role', true) is distinct from current_user
  then
    return new;
  end if;
  if tg_op = 'INSERT'
    and (new.recurring_schedule_id is not null or new.scheduled_for is not null)
  then
    raise exception 'Direct recurrence metadata writes are not allowed';
  end if;
  if tg_op = 'UPDATE'
    and (new.recurring_schedule_id, new.scheduled_for)
      is distinct from (old.recurring_schedule_id, old.scheduled_for)
  then
    raise exception 'Direct recurrence metadata changes are not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_protect_recurring_metadata on public.transactions;
create trigger transactions_protect_recurring_metadata
before insert or update of recurring_schedule_id, scheduled_for
on public.transactions
for each row execute function private.protect_recurring_transaction_metadata();

create or replace function public.convert_transaction_to_recurring_schedule(
  target_transaction_id uuid,
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence public.transactions%rowtype;
  schedule_id uuid;
  target_household_id uuid;
begin
  select *
  into occurrence
  from public.transactions
  where id = target_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;
  target_household_id := occurrence.household_id;
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;
  if occurrence.source is distinct from 'manual'::public.transaction_source
    or occurrence.recurring_schedule_id is not null
    or occurrence.scheduled_for is not null
    or target_kind not in ('income', 'expense')
    or target_interval_count not between 1 and 365
  then
    raise exception 'Only an unlinked manual income or expense can be converted';
  end if;
  if target_amount is null or target_occurred_on is null or target_cadence is null then
    raise exception 'Recurring amount, anchor, cadence, and target date are required';
  end if;
  if not private.recurring_destination_is_valid(
    target_household_id, target_paid_by, target_kind, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end
  ) then
    raise exception using errcode = 'P0001', message = 'recurring_destination: schedule destination is unavailable';
  end if;
  perform private.recurring_occurrence_after(
    target_occurred_on, target_cadence, target_interval_count, current_date
  );

  insert into public.recurring_transaction_schedules (
    household_id, created_by, paid_by, kind, amount, merchant, note,
    category_id, subcategory_id, anchor_date, cadence, interval_count,
    next_occurrence_index, next_occurs_on, status,
    service_period_start, service_period_end
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount,
    coalesce(target_merchant, ''), coalesce(target_note, ''), target_category_id,
    target_subcategory_id, target_occurred_on, target_cadence, target_interval_count,
    1, private.recurring_occurrence_date(target_occurred_on, target_cadence, target_interval_count, 1),
    'active', target_service_period_start, target_service_period_end
  ) returning id into schedule_id;

  perform pg_catalog.set_config('joint.recurring_write', 'on', true);
  update public.transactions
  set paid_by = target_paid_by,
      kind = target_kind,
      amount = target_amount,
      occurred_on = target_occurred_on,
      merchant = coalesce(target_merchant, ''),
      note = coalesce(target_note, ''),
      category_id = target_category_id,
      subcategory_id = target_subcategory_id,
      service_period_start = target_service_period_start,
      service_period_end = target_service_period_end,
      recurring_schedule_id = schedule_id,
      scheduled_for = target_occurred_on
  where id = occurrence.id;
  perform pg_catalog.set_config('joint.recurring_write', 'off', true);

  return schedule_id;
end;
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
  if target_occurred_on is null or target_cadence is null or target_interval_count is null then
    raise exception 'anchor, cadence, and target date are required';
  end if;
  if target_kind not in ('income', 'expense') then
    raise exception 'Recurring schedules support income and expense only';
  end if;
  if not private.recurring_destination_is_valid(
    target_household_id, target_paid_by, target_kind, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end
  ) then
    raise exception using errcode = 'P0001', message = 'recurring_destination: schedule destination is unavailable';
  end if;
  perform private.recurring_occurrence_after(
    target_occurred_on, target_cadence, target_interval_count, current_date
  );

  if target_first_occurrence_transaction_id is not null then
    select *
    into existing_transaction
    from public.transactions
    where id = target_first_occurrence_transaction_id
      and household_id = target_household_id
    for update;
    if not found
      or existing_transaction.source is distinct from 'manual'::public.transaction_source
      or existing_transaction.recurring_schedule_id is not null
      or existing_transaction.scheduled_for is not null
      or existing_transaction.kind is distinct from target_kind
      or existing_transaction.amount is distinct from target_amount
      or existing_transaction.occurred_on is distinct from target_occurred_on
      or lower(btrim(existing_transaction.merchant)) is distinct from lower(btrim(target_merchant))
    then
      raise exception 'Existing transaction must match the duplicate';
    end if;
    return public.convert_transaction_to_recurring_schedule(
      target_first_occurrence_transaction_id, target_paid_by, target_kind, target_amount,
      target_occurred_on, target_merchant, target_note, target_category_id,
      target_subcategory_id, target_service_period_start, target_service_period_end,
      target_cadence, target_interval_count
    );
  end if;

  insert into public.recurring_transaction_schedules (
    household_id, created_by, paid_by, kind, amount, merchant, note,
    category_id, subcategory_id, anchor_date, cadence, interval_count,
    next_occurrence_index, next_occurs_on, status,
    service_period_start, service_period_end
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount,
    coalesce(target_merchant, ''), coalesce(target_note, ''), target_category_id,
    target_subcategory_id, target_occurred_on, target_cadence, target_interval_count,
    1, private.recurring_occurrence_date(target_occurred_on, target_cadence, target_interval_count, 1),
    'active', target_service_period_start, target_service_period_end
  ) returning id into schedule_id;

  if create_initial_occurrence then
    perform pg_catalog.set_config('joint.recurring_write', 'on', true);
    insert into public.transactions (
      household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note,
      category_id, subcategory_id, service_period_start, service_period_end,
      recurring_schedule_id, scheduled_for
    ) values (
      target_household_id, auth.uid(), target_paid_by, target_kind, target_amount,
      target_occurred_on, coalesce(target_merchant, ''), coalesce(target_note, ''),
      target_category_id, target_subcategory_id, target_service_period_start,
      target_service_period_end, schedule_id, target_occurred_on
    );
    perform pg_catalog.set_config('joint.recurring_write', 'off', true);
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;
  return private.create_recurring_transaction_schedule(
    target_household_id, target_paid_by, target_kind, target_amount,
    target_occurred_on, target_merchant, target_note, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end,
    target_cadence, target_interval_count, true, null
  );
end;
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;
  return private.create_recurring_transaction_schedule(
    target_household_id, target_paid_by, target_kind, target_amount,
    target_occurred_on, target_merchant, target_note, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end,
    target_cadence, target_interval_count, false, target_existing_transaction_id
  );
end;
$$;

create function public.save_recurring_transaction_occurrence(
  target_transaction_id uuid,
  target_scope text default null,
  target_kind public.transaction_kind default null,
  target_amount numeric default null,
  target_occurred_on date default null,
  target_merchant text default null,
  target_note text default null,
  target_paid_by uuid default null,
  target_category_id uuid default null,
  target_subcategory_id uuid default null,
  target_service_period_start date default null,
  target_service_period_end date default null,
  target_cadence public.recurring_schedule_cadence default null,
  target_interval_count integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_id uuid;
  schedule public.recurring_transaction_schedules%rowtype;
  occurrence public.transactions%rowtype;
  row_to_update public.transactions%rowtype;
  old_index integer;
  row_index integer;
  template_start date;
  template_end date;
  row_start date;
  row_end date;
  next_occurrence record;
begin
  if target_scope not in ('this', 'future', 'all') then
    raise exception 'Invalid recurring edit scope';
  end if;
  select recurring_schedule_id into schedule_id
  from public.transactions
  where id = target_transaction_id;
  if schedule_id is null then
    raise exception 'Transaction is not a recurring occurrence';
  end if;

  select * into schedule
  from public.recurring_transaction_schedules
  where id = schedule_id
  for update;
  if not found or not private.is_household_member(schedule.household_id) then
    raise exception 'Not a household member';
  end if;
  select * into occurrence
  from public.transactions
  where id = target_transaction_id
    and recurring_schedule_id = schedule.id
  for update;
  if not found then
    raise exception 'Transaction is not a recurring occurrence';
  end if;
  if target_kind not in ('income', 'expense') or target_occurred_on is null then
    raise exception 'Recurring transaction kind and posting date are required';
  end if;
  if target_scope in ('future', 'all')
    and (target_kind is distinct from occurrence.kind or target_occurred_on is distinct from occurrence.occurred_on)
  then
    raise exception 'Kind and posting date changes apply only to this occurrence';
  end if;
  if target_scope in ('future', 'all')
    and (target_cadence is null or target_interval_count is null)
  then
    raise exception 'Future and all recurring edits require cadence fields';
  end if;
  if target_scope = 'this' then
    target_cadence := schedule.cadence;
    target_interval_count := schedule.interval_count;
  end if;
  if target_interval_count is not null and target_interval_count not between 1 and 365 then
    raise exception 'Recurring interval_count must be between 1 and 365.';
  end if;
  if target_scope in ('future', 'all') and not private.recurring_destination_is_valid(
    schedule.household_id, target_paid_by, target_kind, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end
  ) then
    raise exception using errcode = 'P0001', message = 'recurring_destination: schedule destination is unavailable';
  end if;
  if target_scope = 'this' and not private.recurring_destination_is_valid(
    schedule.household_id, target_paid_by, target_kind, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end
  ) then
    raise exception using errcode = 'P0001', message = 'recurring_destination: transaction destination is unavailable';
  end if;

  old_index := private.recurring_occurrence_index(
    schedule.anchor_date, schedule.cadence, schedule.interval_count, occurrence.scheduled_for
  );
  if target_scope in ('future', 'all') then
    template_start := case when target_service_period_start is null then null else
      private.recurring_occurrence_date_with_offset(
        target_service_period_start, schedule.cadence, schedule.interval_count, -old_index
      ) end;
    template_end := case when target_service_period_end is null then null else
      private.recurring_occurrence_date_with_offset(
        target_service_period_end, schedule.cadence, schedule.interval_count, -old_index
      ) end;
    select * into next_occurrence
    from private.recurring_occurrence_after(
      schedule.anchor_date, target_cadence, target_interval_count, current_date
    );

    if target_scope = 'all' then
      perform pg_catalog.set_config('joint.recurring_write', 'on', true);
      for row_to_update in
        select *
        from public.transactions
        where recurring_schedule_id = schedule.id
        order by scheduled_for, id
        for update
      loop
        row_index := private.recurring_occurrence_index(
          schedule.anchor_date, schedule.cadence, schedule.interval_count, row_to_update.scheduled_for
        );
        row_start := case when template_start is null then null else
          private.recurring_occurrence_date(template_start, schedule.cadence, schedule.interval_count, row_index) end;
        row_end := case when template_end is null then null else
          private.recurring_occurrence_date(template_end, schedule.cadence, schedule.interval_count, row_index) end;
        update public.transactions
        set kind = target_kind,
            amount = target_amount,
            merchant = coalesce(target_merchant, ''),
            note = coalesce(target_note, ''),
            paid_by = target_paid_by,
            category_id = target_category_id,
            subcategory_id = target_subcategory_id,
            service_period_start = row_start,
            service_period_end = row_end
        where id = row_to_update.id;
      end loop;
      perform pg_catalog.set_config('joint.recurring_write', 'off', true);
    end if;

    update public.recurring_transaction_schedules
    set amount = target_amount,
        merchant = coalesce(target_merchant, ''),
        note = coalesce(target_note, ''),
        paid_by = target_paid_by,
        kind = target_kind,
        category_id = target_category_id,
        subcategory_id = target_subcategory_id,
        service_period_start = template_start,
        service_period_end = template_end,
        cadence = target_cadence,
        interval_count = target_interval_count,
        next_occurrence_index = next_occurrence.occurrence_index,
        next_occurs_on = next_occurrence.occurs_on
    where id = schedule.id;
  elsif target_scope = 'this' then
    perform pg_catalog.set_config('joint.recurring_write', 'on', true);
    update public.transactions
    set kind = target_kind,
        amount = target_amount,
        occurred_on = target_occurred_on,
        merchant = coalesce(target_merchant, ''),
        note = coalesce(target_note, ''),
        paid_by = target_paid_by,
        category_id = target_category_id,
        subcategory_id = target_subcategory_id,
        service_period_start = target_service_period_start,
        service_period_end = target_service_period_end
    where id = occurrence.id;
    perform pg_catalog.set_config('joint.recurring_write', 'off', true);
  end if;
end;
$$;

create function public.set_recurring_transaction_schedule_status(
  target_schedule_id uuid,
  target_status public.recurring_schedule_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household_id uuid;
begin
  select schedule.household_id
  into household_id
  from public.recurring_transaction_schedules as schedule
  where schedule.id = target_schedule_id;
  if household_id is null or not private.is_household_member(household_id) then
    raise exception 'Not a household member';
  end if;
  perform private.transition_recurring_schedule_status(target_schedule_id, target_status);
end;
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
  if not found or not private.is_household_member(schedule.household_id) then
    raise exception 'Not a household member';
  end if;
  select * into next_occurrence
  from private.recurring_occurrence_after(
    schedule.anchor_date, target_cadence, target_interval_count, current_date
  );
  update public.recurring_transaction_schedules
  set amount = target_amount,
      merchant = coalesce(target_merchant, ''),
      note = coalesce(target_note, ''),
      cadence = target_cadence,
      interval_count = target_interval_count,
      next_occurrence_index = next_occurrence.occurrence_index,
      next_occurs_on = next_occurrence.occurs_on
  where id = schedule.id;
end;
$$;

create or replace function public.update_recurring_transaction_occurrence(
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
  schedule_id uuid;
  occurrence public.transactions%rowtype;
  schedule public.recurring_transaction_schedules%rowtype;
begin
  select recurring_schedule_id into schedule_id
  from public.transactions
  where id = target_transaction_id;
  if schedule_id is null then
    raise exception 'Transaction is not a recurring occurrence';
  end if;
  select * into schedule
  from public.recurring_transaction_schedules
  where id = schedule_id
  for update;
  if not found or not private.is_household_member(schedule.household_id) then
    raise exception 'Not a household member';
  end if;
  select * into occurrence
  from public.transactions
  where id = target_transaction_id
    and recurring_schedule_id = schedule.id
  for update;
  if not found then
    raise exception 'Transaction is not a recurring occurrence';
  end if;
  perform public.save_recurring_transaction_occurrence(
    target_transaction_id, target_scope, occurrence.kind, target_amount, occurrence.occurred_on,
    target_merchant, target_note, target_paid_by, target_category_id, target_subcategory_id,
    target_service_period_start, target_service_period_end, schedule.cadence, schedule.interval_count
  );
end;
$$;

create or replace function public.set_recurring_transaction_schedule_enabled(
  target_schedule_id uuid,
  target_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household_id uuid;
begin
  select schedule.household_id
  into household_id
  from public.recurring_transaction_schedules as schedule
  where schedule.id = target_schedule_id;
  if household_id is null or not private.is_household_member(household_id) then
    raise exception 'Not a household member';
  end if;
  perform public.set_recurring_transaction_schedule_status(
    target_schedule_id,
    case when target_enabled then 'active'::public.recurring_schedule_status else 'paused'::public.recurring_schedule_status end
  );
end;
$$;

create or replace function public.delete_recurring_transaction_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household_id uuid;
begin
  select schedule.household_id
  into household_id
  from public.recurring_transaction_schedules as schedule
  where schedule.id = target_schedule_id;
  if household_id is null or not private.is_household_member(household_id) then
    raise exception 'Not a household member';
  end if;
  perform public.set_recurring_transaction_schedule_status(
    target_schedule_id, 'stopped'::public.recurring_schedule_status
  );
end;
$$;

drop function public.process_due_recurring_transaction_schedules(date);
create function public.process_due_recurring_transaction_schedules(target_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.recurring_transaction_schedules%rowtype;
  occurrence date;
  is_bills boolean;
  created_count integer := 0;
  blocked_count integer := 0;
  schedule_created_count integer;
begin
  for schedule in
    select *
    from public.recurring_transaction_schedules
    where status = 'active'::public.recurring_schedule_status
      and next_occurs_on <= target_today
    order by next_occurs_on, id
    for update skip locked
  loop
    if not private.recurring_destination_is_valid(
      schedule.household_id, schedule.paid_by, schedule.kind,
      schedule.category_id, schedule.subcategory_id,
      schedule.service_period_start, schedule.service_period_end
    ) then
      perform private.transition_recurring_schedule_status(
        schedule.id, 'blocked'::public.recurring_schedule_status,
        'destination_unavailable', true
      );
      blocked_count := blocked_count + 1;
      continue;
    end if;

    schedule_created_count := 0;
    begin
      perform private.recurring_occurrence_after_from(
        schedule.anchor_date, schedule.cadence, schedule.interval_count,
        target_today, schedule.next_occurrence_index
      );

      while schedule.next_occurs_on <= target_today loop
        occurrence := schedule.next_occurs_on;
        select coalesce(category.system_key = 'bills', false)
        into is_bills
        from public.subcategories as subcategory
        join public.categories as category
          on category.id = subcategory.category_id
         and category.household_id = subcategory.household_id
        where subcategory.household_id = schedule.household_id
          and subcategory.id = schedule.subcategory_id;

        perform pg_catalog.set_config('joint.recurring_write', 'on', true);
        insert into public.transactions (
          household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note,
          category_id, subcategory_id, service_period_start, service_period_end,
          recurring_schedule_id, scheduled_for
        ) values (
          schedule.household_id, schedule.created_by, schedule.paid_by, schedule.kind,
          schedule.amount, occurrence, schedule.merchant, schedule.note,
          schedule.category_id, schedule.subcategory_id,
          case when is_bills then private.recurring_occurrence_date(
            schedule.service_period_start, schedule.cadence, schedule.interval_count,
            schedule.next_occurrence_index
          ) else null end,
          case when is_bills then private.recurring_occurrence_date(
            schedule.service_period_end, schedule.cadence, schedule.interval_count,
            schedule.next_occurrence_index
          ) else null end,
          schedule.id, occurrence
        ) on conflict (recurring_schedule_id, scheduled_for) where recurring_schedule_id is not null do nothing;
        if found then
          schedule_created_count := schedule_created_count + 1;
        end if;
        perform pg_catalog.set_config('joint.recurring_write', 'off', true);

        update public.recurring_transaction_schedules
        set next_occurrence_index = schedule.next_occurrence_index + 1,
            next_occurs_on = private.recurring_occurrence_date(
              schedule.anchor_date, schedule.cadence, schedule.interval_count,
              schedule.next_occurrence_index + 1
            ),
            status_reason = null
        where id = schedule.id
        returning * into schedule;
      end loop;
      created_count := created_count + schedule_created_count;
    exception
      when sqlstate 'P0001' then
        if sqlerrm not like 'recurring_destination:%' then
          raise;
        end if;
        perform pg_catalog.set_config('joint.recurring_write', 'off', true);
        perform private.transition_recurring_schedule_status(
          schedule.id, 'blocked'::public.recurring_schedule_status,
          'destination_unavailable', true
        );
        blocked_count := blocked_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'created_count', created_count,
    'blocked_count', blocked_count
  );
end;
$$;

revoke execute on function private.recurring_occurrence_date_with_offset(date, public.recurring_schedule_cadence, integer, integer) from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_date(date, public.recurring_schedule_cadence, integer, integer) from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_index(date, public.recurring_schedule_cadence, integer, date) from public, anon, authenticated;
revoke execute on function private.recurring_destination_is_valid(uuid, uuid, public.transaction_kind, uuid, uuid, date, date) from public, anon, authenticated;
revoke execute on function private.recurring_occurrence_destination_is_valid(uuid, uuid, public.transaction_kind, uuid, uuid, date, date) from public, anon, authenticated;
revoke execute on function private.validate_recurring_schedule_destination() from public, anon, authenticated;
revoke execute on function private.validate_recurring_occurrence_destination() from public, anon, authenticated;
revoke execute on function private.transition_recurring_schedule_status(uuid, public.recurring_schedule_status, text, boolean) from public, anon, authenticated;
revoke execute on function private.recurring_schedule_destination_after_change() from public, anon, authenticated;
revoke execute on function private.protect_recurring_transaction_metadata() from public, anon, authenticated;
revoke execute on function private.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, boolean, uuid) from public, anon, authenticated;

revoke execute on function public.convert_transaction_to_recurring_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) from public, anon;
revoke execute on function public.save_recurring_transaction_occurrence(uuid, text, public.transaction_kind, numeric, date, text, text, uuid, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.set_recurring_transaction_schedule_status(uuid, public.recurring_schedule_status) from public, anon;
revoke execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) from public, anon;
revoke execute on function public.update_recurring_transaction_occurrence(uuid, text, numeric, text, text, uuid, uuid, uuid, date, date) from public, anon;
revoke execute on function public.set_recurring_transaction_schedule_enabled(uuid, boolean) from public, anon;
revoke execute on function public.delete_recurring_transaction_schedule(uuid) from public, anon;
revoke execute on function public.process_due_recurring_transaction_schedules(date) from public, anon, authenticated;

grant execute on function public.convert_transaction_to_recurring_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.create_recurring_transaction_schedule_after_duplicate(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer, uuid) to authenticated;
grant execute on function public.save_recurring_transaction_occurrence(uuid, text, public.transaction_kind, numeric, date, text, text, uuid, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.set_recurring_transaction_schedule_status(uuid, public.recurring_schedule_status) to authenticated;
grant execute on function public.update_recurring_transaction_schedule(uuid, numeric, text, text, public.recurring_schedule_cadence, integer) to authenticated;
grant execute on function public.update_recurring_transaction_occurrence(uuid, text, numeric, text, text, uuid, uuid, uuid, date, date) to authenticated;
grant execute on function public.set_recurring_transaction_schedule_enabled(uuid, boolean) to authenticated;
grant execute on function public.delete_recurring_transaction_schedule(uuid) to authenticated;
grant execute on function public.process_due_recurring_transaction_schedules(date) to service_role;

commit;
