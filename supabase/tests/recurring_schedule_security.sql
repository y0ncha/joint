begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(49);

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
  (public.process_due_recurring_transaction_schedules(current_date)->>'created_count')::integer,
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

select extensions.throws_like(
  $$ select public.process_due_recurring_transaction_schedules(current_date) $$,
  '%maximum of 366%',
  'cron surfaces an over-cap schedule instead of hiding a non-destination failure'
);

set local role postgres;

select extensions.is(
  (select enabled from public.recurring_transaction_schedules where id = '00000000-0000-0000-0000-000000000620'),
  true,
  'cron leaves an over-cap schedule active when it surfaces the failure'
);

select extensions.is(
  (select status_reason from public.recurring_transaction_schedules where id = '00000000-0000-0000-0000-000000000620'),
  null,
  'cron does not misclassify a catch-up failure as a destination block'
);

select extensions.is(
  (select count(*) from public.transactions where recurring_schedule_id = '00000000-0000-0000-0000-000000000620'),
  0::bigint,
  'cron leaves the over-cap schedule ledger untouched'
);

delete from public.recurring_transaction_schedules
where id = '00000000-0000-0000-0000-000000000620';

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

set local role authenticated;

insert into public.subcategories (household_id, category_id, name)
select household_id, id, 'Recurring utilities'
from public.categories
where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'bills';

select extensions.lives_ok(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 20, current_date - 14,
      'Recurring utility bill', '', null,
      (select id from public.subcategories where household_id = '00000000-0000-0000-0000-000000000610' and name = 'Recurring utilities'),
      current_date - 20, current_date - 14, 'weekly', 1
    )
  $$,
  'a Bills schedule stores its initial service-period template'
);

set local role service_role;

select extensions.is(
  (public.process_due_recurring_transaction_schedules(current_date)->>'created_count')::integer,
  2,
  'cron creates each due Bills occurrence exactly once'
);

set local role postgres;

select extensions.ok(
  exists (
    select 1
    from public.transactions
    where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Recurring utility bill')
      and scheduled_for = current_date
      and service_period_start = current_date - 6
      and service_period_end = current_date
  ),
  'a weekly Bills occurrence shifts both service-period endpoints with its posting date'
);

set local role authenticated;

select extensions.lives_ok(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 30, date '2026-01-31',
      'Month-end utility bill', '', null,
      (select id from public.subcategories where household_id = '00000000-0000-0000-0000-000000000610' and name = 'Recurring utilities'),
      date '2026-01-01', date '2026-01-31', 'monthly', 1
    )
  $$,
  'a month-end Bills schedule remains creatable'
);

set local role service_role;

select public.process_due_recurring_transaction_schedules(date '2026-03-31');

set local role postgres;

select extensions.ok(
  exists (
    select 1
    from public.transactions
    where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Month-end utility bill')
      and scheduled_for = date '2026-03-31'
      and service_period_start = date '2026-03-01'
      and service_period_end = date '2026-03-31'
  ),
  'a monthly month-end Bills occurrence clips and shifts both service-period endpoints'
);

set local role authenticated;

select extensions.lives_ok(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 20, current_date - 14,
      'Future utility bill', '', null,
      (select id from public.subcategories where household_id = '00000000-0000-0000-0000-000000000610' and name = 'Recurring utilities'),
      current_date - 20, current_date - 14, 'weekly', 1
    )
  $$,
  'a schedule is available for future-scope history preservation'
);

set local role service_role;

select public.process_due_recurring_transaction_schedules(current_date);

set local role authenticated;

select public.update_recurring_transaction_occurrence(
  (select id from public.transactions where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Future utility bill') and scheduled_for = current_date),
  'future', 35, 'Future utility bill updated', '', null, null,
  (select id from public.subcategories where household_id = '00000000-0000-0000-0000-000000000610' and name = 'Recurring utilities'),
  current_date - 6, current_date
);

select extensions.ok(
  (
    select count(*) = 3
      and bool_and(amount = 20)
      and bool_and(merchant = 'Future utility bill')
      and bool_and(occurred_on = scheduled_for)
    from public.transactions
    where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Future utility bill updated')
  ),
  'future-scope edits preserve every existing generated transaction'
);

set local role service_role;

select public.process_due_recurring_transaction_schedules(current_date + 7);

set local role postgres;

select extensions.ok(
  exists (
    select 1
    from public.transactions
    where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Future utility bill updated')
      and scheduled_for = current_date + 7
      and amount = 35
      and service_period_start = current_date + 1
      and service_period_end = current_date + 7
  ),
  'future-scope edits apply to the next generated Bills transaction'
);

set local role authenticated;

select public.update_recurring_transaction_occurrence(
  (select id from public.transactions where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Recurring utility bill') and scheduled_for = current_date),
  'all', 25, 'Updated utility bill', '', null, null,
  (select id from public.subcategories where household_id = '00000000-0000-0000-0000-000000000610' and name = 'Recurring utilities'),
  current_date - 6, current_date
);

select extensions.ok(
  (
    select count(*) = 4
      and bool_and(amount = 25)
      and bool_and(occurred_on = scheduled_for)
    from public.transactions
    where recurring_schedule_id = (select id from public.recurring_transaction_schedules where merchant = 'Updated utility bill')
  ),
  'all-scope recurring edits update generated values without changing posting dates'
);

select extensions.ok(
  to_regtype('public.recurring_schedule_status') is not null
  and to_regclass('public.recurring_transaction_schedule_events') is not null,
  'lifecycle status type and durable event table exist'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recurring_transaction_schedules'
      and column_name = 'first_occurrence_transaction_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recurring_transaction_schedules'
      and column_name = 'status'
      and udt_schema = 'public'
      and udt_name = 'recurring_schedule_status'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recurring_transaction_schedules'
      and column_name = 'status_reason'
  ),
  'legacy pointer is removed and status columns use the new contract'
);

select extensions.ok(
  (
    select attgenerated = 's'
    from pg_catalog.pg_attribute
    where attrelid = 'public.recurring_transaction_schedules'::regclass
      and attname = 'enabled'
  )
  and (
    select pg_catalog.pg_get_expr(adbin, adrelid)
    from pg_catalog.pg_attrdef
    join pg_catalog.pg_attribute
      on pg_attribute.attrelid = pg_attrdef.adrelid
     and pg_attribute.attnum = pg_attrdef.adnum
    where adrelid = 'public.recurring_transaction_schedules'::regclass
      and pg_attribute.attname = 'enabled'
  ) like '%status%active%',
  'enabled remains a stored generated status compatibility column'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_recurring_metadata_pair_check'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_recurring_schedule_source_check'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_recurring_schedule_id_fkey'
      and pg_catalog.pg_get_constraintdef(oid) like '%household_id, recurring_schedule_id%'
      and pg_catalog.pg_get_constraintdef(oid) like '%RESTRICT%'
  ),
  'recurring links enforce paired metadata, manual source, and composite household ownership'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.recurring_transaction_schedules'::regclass
      and contype = 'u'
      and pg_catalog.pg_get_constraintdef(oid) like '%household_id, id%'
  )
  and exists (
    select 1
    from pg_catalog.pg_index
    where indrelid = 'public.recurring_transaction_schedules'::regclass
      and pg_catalog.pg_get_indexdef(indexrelid) like '%category_id%'
      and pg_catalog.pg_get_expr(indpred, indrelid) like '%category_id IS NOT NULL%'
  )
  and exists (
    select 1
    from pg_catalog.pg_index
    where indrelid = 'public.recurring_transaction_schedules'::regclass
      and pg_catalog.pg_get_indexdef(indexrelid) like '%subcategory_id%'
      and pg_catalog.pg_get_expr(indpred, indrelid) like '%subcategory_id IS NOT NULL%'
  ),
  'schedule household identity and destination foreign-key indexes exist'
);

select extensions.ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.recurring_transaction_schedule_events'::regclass
  )
  and has_table_privilege('authenticated', 'public.recurring_transaction_schedule_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.recurring_transaction_schedule_events', 'INSERT')
  and not has_table_privilege('authenticated', 'public.recurring_transaction_schedules', 'UPDATE'),
  'lifecycle history is RLS-protected and member writes stay behind RPCs'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.convert_transaction_to_recurring_schedule(uuid, uuid, public.transaction_kind, numeric, date, text, text, uuid, uuid, date, date, public.recurring_schedule_cadence, integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.save_recurring_transaction_occurrence(uuid, text, public.transaction_kind, numeric, date, text, text, uuid, uuid, uuid, date, date, public.recurring_schedule_cadence, integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.set_recurring_transaction_schedule_status(uuid, public.recurring_schedule_status)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.set_recurring_transaction_schedule_status(uuid, public.recurring_schedule_status)',
    'EXECUTE'
  ),
  'member lifecycle RPCs are callable only by authenticated members'
);

select extensions.ok(
  (
    select p.prorettype = 'jsonb'::regtype
    from pg_catalog.pg_proc as p
    where p.oid = 'public.process_due_recurring_transaction_schedules(date)'::regprocedure
  )
  and has_function_privilege(
    'service_role',
    'public.process_due_recurring_transaction_schedules(date)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.process_due_recurring_transaction_schedules(date)',
    'EXECUTE'
  ),
  'the processor returns JSON counts and is service-role-only'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.transactions'::regclass
      and tgname = 'transactions_protect_recurring_metadata'
      and not tgisinternal
  )
  and exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.recurring_transaction_schedules'::regclass
      and tgname = 'recurring_transaction_schedules_block_invalid_destination'
      and not tgisinternal
  ),
  'protected recurrence metadata and destination blocking triggers exist'
);

set local role authenticated;

select extensions.ok(
  (
    select count(*) > 0
    from public.transactions
    where recurring_schedule_id is not null
      and scheduled_for is not null
      and source = 'manual'
  )
  and not exists (
    select 1
    from public.transactions
    where recurring_schedule_id is not null
      and scheduled_for is null
  ),
  'existing occurrence zero remains canonically linked to its schedule date'
);

select extensions.throws_like(
  $$
    update public.transactions
    set recurring_schedule_id = null, scheduled_for = null
    where id = (select id from public.transactions where recurring_schedule_id is not null limit 1)
  $$,
  '%recurrence metadata%',
  'authenticated direct recurrence metadata clearing is rejected'
);

set local role postgres;

insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source
)
values (
  '00000000-0000-0000-0000-000000000630',
  '00000000-0000-0000-0000-000000000610',
  '00000000-0000-0000-0000-000000000601',
  'expense', 42, current_date - 2, 'Original merchant', 'Original note',
  (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
  'manual'
);

set local role authenticated;

select extensions.lives_ok(
  $$
    select public.convert_transaction_to_recurring_schedule(
      '00000000-0000-0000-0000-000000000630', null, 'expense', 47,
      current_date - 2, 'Converted merchant', 'Converted note',
      (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, 'weekly', 1
    )
  $$,
  'a regular manual transaction converts atomically to occurrence zero'
);

select extensions.ok(
  (
    select recurring_schedule_id is not null
      and scheduled_for = occurred_on
      and amount = 47
      and merchant = 'Converted merchant'
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000630'
  )
  and (
    select count(*) = 1
    from public.transactions
    where recurring_schedule_id = (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630')
  ),
  'conversion preserves one ledger row as canonical occurrence zero'
);

select public.set_recurring_transaction_schedule_status(
  (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
  'paused'
);

select extensions.is(
  (
    select status::text
    from public.recurring_transaction_schedules
    where id = (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630')
  ),
  'paused',
  'a member can pause a recurring schedule'
);

select extensions.is(
  (
    select count(*)
    from public.recurring_transaction_schedule_events
    where schedule_id = (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630')
  ),
  1::bigint,
  'each status transition writes exactly one lifecycle event'
);

select public.set_recurring_transaction_schedule_status(
  (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
  'active'
);

select public.delete_recurring_transaction_schedule(
  (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630')
);

select extensions.is(
  (
    select status::text
    from public.recurring_transaction_schedules
    where id = (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630')
  ),
  'stopped',
  'the compatibility delete adapter stops without deleting schedule history'
);

select extensions.throws_like(
  $$
    select public.set_recurring_transaction_schedule_status(
      (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
      'active'
    )
  $$,
  '%terminal%',
  'stopped schedules cannot resume'
);

select extensions.throws_like(
  $$
    insert into public.recurring_transaction_schedule_events (
      schedule_id, household_id, previous_status, new_status
    ) values (
      (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
      '00000000-0000-0000-0000-000000000610', 'paused', 'active'
    )
  $$,
  '%permission denied%',
  'members cannot write lifecycle events directly'
);

set local role postgres;

insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source
)
values (
  '00000000-0000-0000-0000-000000000631',
  '00000000-0000-0000-0000-000000000610',
  '00000000-0000-0000-0000-000000000601',
  'expense', 9, current_date - 3, 'Unlinked', '',
  (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
  'manual'
);

set local role authenticated;

select extensions.throws_like(
  $$
    update public.transactions
    set recurring_schedule_id = (select recurring_schedule_id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
        scheduled_for = occurred_on
    where id = '00000000-0000-0000-0000-000000000631'
  $$,
  '%recurrence metadata%',
  'authenticated members cannot set recurrence metadata directly'
);

select extensions.lives_ok(
  $$
    select public.save_recurring_transaction_occurrence(
      (select id from public.transactions where id = '00000000-0000-0000-0000-000000000630'),
      'this', 'expense', 51, current_date - 1, 'Edited occurrence', 'Edited note', null,
      (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000610' and system_key = 'other_expense'),
      null, null, null, null, null
    )
  $$,
  'the new occurrence RPC saves a this-scope edit atomically'
);

select extensions.ok(
  (
    select occurred_on = current_date - 1
      and scheduled_for = current_date - 2
      and amount = 51
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000630'
  ),
  'this-scope edits may change posting date while preserving scheduled identity'
);

set local role postgres;

insert into public.categories (id, household_id, name, kind, color)
values (
  '00000000-0000-0000-0000-000000000640',
  '00000000-0000-0000-0000-000000000610', 'Temporary recurring category', 'expense', '#ccebef'
);
insert into public.subcategories (id, household_id, category_id, name)
values (
  '00000000-0000-0000-0000-000000000641',
  '00000000-0000-0000-0000-000000000610', '00000000-0000-0000-0000-000000000640', 'Temporary recurring destination'
);

set local role authenticated;

select extensions.lives_ok(
  $$
    select public.create_recurring_transaction_schedule(
      '00000000-0000-0000-0000-000000000610', null, 'expense', 12, current_date,
      'Deletable destination', '', null, '00000000-0000-0000-0000-000000000641',
      null, null, 'weekly', 1
    )
  $$,
  'a schedule with a household-owned subcategory is creatable'
);

select extensions.lives_ok(
  $$ delete from public.categories where id = '00000000-0000-0000-0000-000000000640' $$,
  'deleting a schedule destination succeeds without deleting its schedule'
);

select extensions.is(
  (
    select status::text
    from public.recurring_transaction_schedules
    where merchant = 'Deletable destination'
  ),
  'blocked',
  'destination deletion transitions the durable schedule to blocked'
);

select * from extensions.finish();

rollback;
