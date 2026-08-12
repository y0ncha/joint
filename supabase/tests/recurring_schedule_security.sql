begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(16);

select extensions.ok(
  has_schema_privilege('service_role', 'private', 'USAGE')
  and has_function_privilege(
    'service_role',
    'private.recurring_occurrence_after_from(date, public.recurring_schedule_cadence, integer, date, integer)',
    'EXECUTE'
  )
  and not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_function_privilege(
    'anon',
    'private.recurring_occurrence_after_from(date, public.recurring_schedule_cadence, integer, date, integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.recurring_occurrence_after_from(date, public.recurring_schedule_cadence, integer, date, integer)',
    'EXECUTE'
  ),
  'only service_role can execute the bounded recurring occurrence helper'
);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000601', 'recurring-security@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-000000000610', 'Recurring security household', '00000000-0000-0000-0000-000000000601');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000601';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000601"}';

select extensions.throws_like(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 10, date '0001-01-01',
      'Ancient', '', (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, 'weekly', 1
    )
  $$,
  '%maximum of 366%',
  'an ancient recurring anchor is rejected before persistence'
);

select extensions.is(
  (select count(*) from public.recurring_transaction_schedules where household_id = '00000000-0000-0000-0000-000000000610'),
  0::bigint,
  'a rejected ancient schedule leaves no persisted template'
);

select extensions.throws_like(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 10, current_date,
      'Too frequent', '', (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, 'weekly', 366
    )
  $$,
  '%interval_count must be between 1 and 365%',
  'an excessive recurrence interval is rejected at the RPC boundary'
);

select extensions.throws_like(
  $$ select public.create_recurring_transaction_schedule('00000000-0000-0000-0000-000000000610') $$,
  '%anchor, cadence, and target date are required%',
  'omitted recurring arguments fail immediately instead of entering a null loop'
);

select extensions.lives_ok(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 10, current_date - 14,
      'Legitimate bounded schedule', '', (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, 'weekly', 1
    )
  $$,
  'a legitimate recent recurring schedule remains creatable'
);

set local role service_role;

select extensions.lives_ok(
  $$ select * from private.recurring_occurrence_after_from(current_date - 14, 'weekly', 1, current_date, 1) $$,
  'service role can execute the bounded recurring helper and its date calculation'
);

select extensions.is(
  public.process_due_recurring_transaction_schedules(current_date),
  2,
  'cron creates only the bounded due occurrences for a legitimate schedule'
);

set local role authenticated;

select extensions.throws_like(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 10, date '2026-02-30',
      'Invalid date', '', (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, 'weekly', 1
    )
  $$,
  '%date/time field value out of range%',
  'an invalid calendar date cannot reach the recurring RPC'
);

set local role postgres;

insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on
)
values (
  '00000000-0000-0000-0000-000000000620', '00000000-0000-0000-0000-000000000610', '00000000-0000-0000-0000-000000000601',
  'expense', 10, 'Ancient existing schedule', '',
  (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
  date '0001-01-01', 'weekly', 1, 1, date '0001-01-08'
);

set local role authenticated;

select extensions.throws_like(
  $$ select public.update_recurring_transaction_schedule('00000000-0000-0000-0000-000000000620', 11, 'Edited', '', 'weekly', 1) $$,
  '%maximum of 366%',
  'editing an ancient existing schedule is bounded before the cursor loop'
);

set local role service_role;

select extensions.is(
  public.process_due_recurring_transaction_schedules(current_date),
  0,
  'cron does not insert any rows for an over-cap existing schedule'
);

select extensions.is(
  (select enabled from public.recurring_transaction_schedules where id = '00000000-0000-0000-0000-000000000620'),
  false,
  'cron pauses an over-cap existing schedule'
);

select extensions.is(
  (select paused_reason from public.recurring_transaction_schedules where id = '00000000-0000-0000-0000-000000000620'),
  'Recurring schedule catch-up exceeds the maximum of 366 occurrences.',
  'cron records an explicit reason instead of silently truncating history'
);

select extensions.is(
  (select count(*) from public.transactions where recurring_schedule_id = '00000000-0000-0000-0000-000000000620'),
  0::bigint,
  'cron leaves the over-cap schedule ledger untouched'
);

select extensions.is(
  (select enabled from public.recurring_transaction_schedules where merchant = 'Legitimate bounded schedule'),
  true,
  'cron leaves a legitimate existing schedule enabled'
);

select extensions.is(
  (select count(*) from public.transactions where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Legitimate bounded schedule')),
  3::bigint,
  'cron preserves the initial row and creates only bounded due occurrences'
);

select * from extensions.finish();

rollback;
