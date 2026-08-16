begin;

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
    and schedule.status not in ('active', 'paused', 'blocked')
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

commit;
