create type public.recurring_schedule_cadence as enum ('weekly', 'monthly', 'custom_weekly', 'custom_monthly');

create table public.recurring_transaction_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  paid_by uuid references public.profiles(id),
  kind public.transaction_kind not null,
  amount numeric(12, 2) not null check (amount > 0),
  merchant text not null default '' check (char_length(merchant) <= 200),
  note text not null default '' check (char_length(note) <= 500),
  category_id uuid,
  subcategory_id uuid,
  anchor_date date not null,
  cadence public.recurring_schedule_cadence not null,
  interval_count integer not null default 1 check (interval_count > 0),
  next_occurrence_index integer not null default 1 check (next_occurrence_index > 0),
  next_occurs_on date not null,
  enabled boolean not null default true,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, category_id) references public.categories(household_id, id),
  foreign key (household_id, subcategory_id) references public.subcategories(household_id, id),
  check (num_nonnulls(category_id, subcategory_id) = 1)
);

create index recurring_transaction_schedules_due_idx
on public.recurring_transaction_schedules (next_occurs_on)
where enabled;

alter table public.transactions
  add column recurring_schedule_id uuid references public.recurring_transaction_schedules(id) on delete set null,
  add column scheduled_for date;

create unique index transactions_recurring_schedule_occurrence_idx
on public.transactions (recurring_schedule_id, scheduled_for)
where recurring_schedule_id is not null;

alter table public.recurring_transaction_schedules enable row level security;

create policy "Members can manage recurring schedules"
on public.recurring_transaction_schedules
for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create trigger recurring_transaction_schedules_set_updated_at
before update on public.recurring_transaction_schedules
for each row execute function public.set_updated_at();

create or replace function private.recurring_occurrence_date(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  occurrence_index integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  with target as (
    select case
      when cadence in ('weekly', 'custom_weekly')
        then anchor_date + (7 * interval_count * occurrence_index)
      else make_date(
        extract(year from anchor_date)::integer + floor((extract(month from anchor_date)::integer - 1 + interval_count * occurrence_index) / 12)::integer,
        mod(extract(month from anchor_date)::integer - 1 + interval_count * occurrence_index, 12)::integer + 1,
        1
      )
    end as date
  )
  select case
    when cadence in ('weekly', 'custom_weekly') then date
    else make_date(
      extract(year from date)::integer,
      extract(month from date)::integer,
      least(extract(day from anchor_date)::integer, extract(day from (date + interval '1 month - 1 day'))::integer)
    )
  end
  from target;
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
language plpgsql
security invoker
set search_path = ''
as $$
declare
  schedule_id uuid;
begin
  insert into public.recurring_transaction_schedules (
    household_id, created_by, paid_by, kind, amount, merchant, note, category_id, subcategory_id,
    anchor_date, cadence, interval_count, next_occurs_on
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount, target_merchant, target_note, target_category_id, target_subcategory_id,
    target_occurred_on, target_cadence, target_interval_count,
    private.recurring_occurrence_date(target_occurred_on, target_cadence, target_interval_count, 1)
  ) returning id into schedule_id;

  insert into public.transactions (
    household_id, created_by, paid_by, kind, amount, occurred_on, merchant, note, category_id, subcategory_id,
    service_period_start, service_period_end, recurring_schedule_id, scheduled_for
  ) values (
    target_household_id, auth.uid(), target_paid_by, target_kind, target_amount, target_occurred_on, target_merchant, target_note, target_category_id, target_subcategory_id,
    target_service_period_start, target_service_period_end, schedule_id, target_occurred_on
  );
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
  is_bills boolean;
  created_count integer := 0;
begin
  for schedule in
    select * from public.recurring_transaction_schedules
    where enabled and next_occurs_on <= target_today
    order by next_occurs_on
    for update skip locked
  loop
    begin
      while schedule.next_occurs_on <= target_today loop
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
      update public.recurring_transaction_schedules
      set enabled = false, paused_reason = 'Schedule paused because its saved category is no longer available.'
      where id = schedule.id;
    end;
  end loop;
  return created_count;
end;
$$;

revoke execute on function public.process_due_recurring_transaction_schedules(date) from public, anon, authenticated;
grant execute on function public.process_due_recurring_transaction_schedules(date) to service_role;
grant execute on function public.create_recurring_transaction_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer) to authenticated;
