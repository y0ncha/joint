begin;

drop function if exists public.update_recurring_transaction_schedule(
  uuid, numeric, text, text, public.recurring_schedule_cadence, integer
);

drop function if exists public.create_recurring_transaction_schedule(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer
);

drop function if exists public.create_recurring_transaction_schedule_after_duplicate(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer, uuid
);

create function public.create_recurring_transaction_schedule(
  target_household_id uuid default null,
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
  authenticated_household_id uuid;
begin
  select household_id
  into authenticated_household_id
  from public.household_members
  where user_id = auth.uid();

  if authenticated_household_id is null or not private.is_household_member(authenticated_household_id) then
    raise exception 'Not a household member';
  end if;

  return private.create_recurring_transaction_schedule(
    authenticated_household_id, target_paid_by, target_kind, target_amount,
    target_occurred_on, target_merchant, target_note, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end,
    target_cadence, target_interval_count, true, null
  );
end;
$$;

create function public.create_recurring_transaction_schedule_after_duplicate(
  target_household_id uuid default null,
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
declare
  authenticated_household_id uuid;
begin
  select household_id
  into authenticated_household_id
  from public.household_members
  where user_id = auth.uid();

  if authenticated_household_id is null or not private.is_household_member(authenticated_household_id) then
    raise exception 'Not a household member';
  end if;

  return private.create_recurring_transaction_schedule(
    authenticated_household_id, target_paid_by, target_kind, target_amount,
    target_occurred_on, target_merchant, target_note, target_category_id,
    target_subcategory_id, target_service_period_start, target_service_period_end,
    target_cadence, target_interval_count, false, target_existing_transaction_id
  );
end;
$$;

revoke execute on function public.create_recurring_transaction_schedule(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer
) from public, anon;
grant execute on function public.create_recurring_transaction_schedule(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer
) to authenticated;

revoke execute on function public.create_recurring_transaction_schedule_after_duplicate(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer, uuid
) from public, anon;
grant execute on function public.create_recurring_transaction_schedule_after_duplicate(
  uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid,
  date, date, public.recurring_schedule_cadence, integer, uuid
) to authenticated;

commit;
