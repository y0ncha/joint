begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000501', 'dashboard-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000502', 'dashboard-outsider@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000503', 'dashboard-other-owner@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by, opening_balance)
values
  ('00000000-0000-0000-0000-000000000510', 'Dashboard household', '00000000-0000-0000-0000-000000000501', 8000),
  ('00000000-0000-0000-0000-000000000511', 'Other dashboard household', '00000000-0000-0000-0000-000000000503', 999999);

insert into public.categories (id, household_id, name, kind, color, archived_at)
values
  ('00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000510', 'Salary', 'income', '#ccebef', null),
  ('00000000-0000-0000-0000-000000000521', '00000000-0000-0000-0000-000000000510', 'Food', 'expense', '#f8d7d7', null),
  ('00000000-0000-0000-0000-000000000522', '00000000-0000-0000-0000-000000000511', 'Private income', 'income', '#ffcff0', null),
  ('00000000-0000-0000-0000-000000000523', '00000000-0000-0000-0000-000000000510', 'Archived food', 'expense', '#f8d7d7', null),
  ('00000000-0000-0000-0000-000000000524', '00000000-0000-0000-0000-000000000511', 'Private food', 'expense', '#f8d7d7', null);

insert into public.subcategories (id, household_id, category_id, name, color, archived_at)
values
  ('00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000520', 'Pay cheque', '#d9f0fa', null),
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000521', 'Meals', '#ffe1e8', null),
  ('00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000521', 'Groceries', '#ffedec', null),
  ('00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000522', 'Secret', '#ffbff4', null),
  ('00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000523', 'Old', '#ffe1e8', null),
  ('00000000-0000-0000-0000-000000000535', '00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000524', 'Private meals', '#ffe1e8', null);

insert into public.transactions (id, household_id, kind, amount, occurred_on, subcategory_id, created_by, created_at, merchant, note)
values
  ('00000000-0000-0000-0000-000000000540', '00000000-0000-0000-0000-000000000510', 'income', 12000, '2026-04-01', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000501', '2026-04-01 12:00:00+00', 'April salary', ''),
  ('00000000-0000-0000-0000-000000000541', '00000000-0000-0000-0000-000000000510', 'expense', 12000, '2026-04-02', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-04-02 12:00:00+00', 'April expense', ''),
  ('00000000-0000-0000-0000-000000000542', '00000000-0000-0000-0000-000000000510', 'income', 12000, '2026-05-01', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000501', '2026-05-01 12:00:00+00', 'May salary', ''),
  ('00000000-0000-0000-0000-000000000543', '00000000-0000-0000-0000-000000000510', 'expense', 12000, '2026-05-02', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-05-02 12:00:00+00', 'May expense', ''),
  ('00000000-0000-0000-0000-000000000544', '00000000-0000-0000-0000-000000000510', 'income', 3000, '2026-06-01', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000501', '2026-06-01 12:00:00+00', 'June salary', ''),
  ('00000000-0000-0000-0000-000000000545', '00000000-0000-0000-0000-000000000510', 'expense', 1040, '2026-06-02', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-06-02 12:00:00+00', 'June expense', ''),
  ('00000000-0000-0000-0000-000000000546', '00000000-0000-0000-0000-000000000510', 'income', 16000, '2026-07-01', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000501', '2026-07-01 12:00:00+00', 'July salary', ''),
  ('00000000-0000-0000-0000-000000000547', '00000000-0000-0000-0000-000000000510', 'expense', 7000, '2026-07-02', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-07-02 12:00:00+00', 'Rent dinner', ''),
  ('00000000-0000-0000-0000-000000000548', '00000000-0000-0000-0000-000000000510', 'expense', 800, '2026-07-03', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-07-03 12:00:00+00', 'Grocer', ''),
  ('00000000-0000-0000-0000-000000000549', '00000000-0000-0000-0000-000000000510', 'income', 400, '2026-07-04', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000501', '2026-07-04 12:00:00+00', 'Refund', ''),
  ('00000000-0000-0000-0000-000000000550', '00000000-0000-0000-0000-000000000510', 'expense', 100, '2026-07-05', '00000000-0000-0000-0000-000000000533', '00000000-0000-0000-0000-000000000501', '2026-07-05 12:00:00+00', 'Cafe', 'Lunch'),
  ('00000000-0000-0000-0000-000000000554', '00000000-0000-0000-0000-000000000510', 'expense', 250, '2026-07-07', '00000000-0000-0000-0000-000000000534', '00000000-0000-0000-0000-000000000501', '2026-07-07 12:00:00+00', 'Old cafe', 'Archived category history');

update public.subcategories
set archived_at = now()
where id = '00000000-0000-0000-0000-000000000534';

update public.categories
set archived_at = now()
where id = '00000000-0000-0000-0000-000000000523';

insert into public.transactions (id, household_id, kind, amount, occurred_on, category_id, created_by, created_at, merchant)
values (
  '00000000-0000-0000-0000-000000000551',
  '00000000-0000-0000-0000-000000000510',
  'expense',
  40,
  '2026-07-06',
  (select id from public.categories where household_id = '00000000-0000-0000-0000-000000000510' and system_key = 'other_expense'),
  '00000000-0000-0000-0000-000000000501',
  '2026-07-06 12:00:00+00',
  'Corner shop'
);

insert into public.transactions (id, household_id, kind, amount, occurred_on, subcategory_id, created_by, created_at, merchant)
values (
  '00000000-0000-0000-0000-000000000552',
  '00000000-0000-0000-0000-000000000511',
  'income',
  500000,
  '2026-07-01',
  '00000000-0000-0000-0000-000000000532',
  '00000000-0000-0000-0000-000000000503',
  '2026-07-01 12:00:00+00',
  'Must stay private'
);

insert into public.transactions (id, household_id, kind, amount, occurred_on, subcategory_id, created_by, created_at, merchant)
values (
  '00000000-0000-0000-0000-000000000553',
  '00000000-0000-0000-0000-000000000511',
  'expense',
  777,
  '2026-07-02',
  '00000000-0000-0000-0000-000000000535',
  '00000000-0000-0000-0000-000000000503',
  '2026-07-02 12:00:00+00',
  'Private expense'
);

insert into public.transactions (id, household_id, kind, amount, occurred_on, subcategory_id, created_by, created_at, merchant)
values
  (
    '00000000-0000-0000-0000-000000000555',
    '00000000-0000-0000-0000-000000000510',
    'income',
    10,
    current_date,
    '00000000-0000-0000-0000-000000000530',
    '00000000-0000-0000-0000-000000000501',
    now(),
    'Today'
  ),
  (
    '00000000-0000-0000-0000-000000000556',
    '00000000-0000-0000-0000-000000000510',
    'income',
    999,
    current_date + 1,
    '00000000-0000-0000-0000-000000000530',
    '00000000-0000-0000-0000-000000000501',
    now(),
    'Future'
  );

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000501';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501"}';

select results_eq(
  $$ select income, expenses from public.dashboard_summary('2026-07-01', null, null) $$,
  $$ values (16400::numeric, 8190::numeric) $$,
  'summary returns the selected month totals'
);

select results_eq(
  $$
    select
      round(income_change_percentage, 2),
      round(expense_change_percentage, 2),
      round(balance_change_percentage, 2)
    from public.dashboard_summary('2026-07-01')
  $$,
  $$ values (82.22::numeric, -1.88::numeric, 1156.63::numeric) $$,
  'a completed month compares against the previous three full months'
);

select results_eq(
  $$ select round(balance_change_percentage, 2) from public.dashboard_summary('2026-07-01', '2026-07-06', '2026-07-06') $$,
  $$ values (-76::numeric) $$,
  'summary returns the custom-range balance comparison'
);

select results_eq(
  $$
    select category_id, category_name, amount
    from public.dashboard_spending_breakdown(
      '2026-07-01', null, null, array['00000000-0000-0000-0000-000000000521'::uuid], false
    )
  $$,
  $$ values ('00000000-0000-0000-0000-000000000521'::uuid, 'Food'::text, 7900::numeric) $$,
  'selected active Food remains isolated from archived parent history'
);

select results_eq(
  $$
    select category_id, category_name, amount
    from public.dashboard_spending_breakdown(
      '2026-07-01', null, null, array['00000000-0000-0000-0000-000000000521'::uuid], true
    )
  $$,
  $$ values
    ('00000000-0000-0000-0000-000000000531'::uuid, 'Meals'::text, 7800::numeric),
    ('00000000-0000-0000-0000-000000000533'::uuid, 'Groceries'::text, 100::numeric) $$,
  'spending breakdown aggregates the selected parent by subcategory'
);

select results_eq(
  $$
    select category_name, amount
    from public.dashboard_spending_breakdown('2026-07-01', null, null, null, false)
  $$,
  $$ values
    ('Food'::text, 7900::numeric),
    ('Archived food'::text, 250::numeric),
    ('Other'::text, 40::numeric) $$,
  'null category selections preserve historical archived parent totals'
);

select results_eq(
  $$
    select category_name, amount
    from public.dashboard_spending_breakdown(
      '2026-07-01', null, null,
      array[
        '00000000-0000-0000-0000-000000000599'::uuid,
        '00000000-0000-0000-0000-000000000523'::uuid,
        '00000000-0000-0000-0000-000000000520'::uuid,
        '00000000-0000-0000-0000-000000000524'::uuid
      ],
      false
    )
  $$,
  $$ values
    ('Food'::text, 7900::numeric),
    ('Archived food'::text, 250::numeric),
    ('Other'::text, 40::numeric)
  $$,
  'wholly ineligible category selections preserve historical archived parent totals'
);

select ok(
  (
    select count(*) = 3
      and bool_and(
        not procedure.prosecdef
        and procedure.provolatile = 's'
        and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']
      )
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'public'
      and procedure.proname in ('dashboard_summary', 'dashboard_spending_breakdown', 'dashboard_monthly_review')
  ),
  'dashboard projections are stable security-invoker functions with an empty search path'
);

select ok(
  has_function_privilege('authenticated', 'public.dashboard_summary(date,date,date)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.dashboard_spending_breakdown(date,date,date,uuid[],boolean)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.dashboard_monthly_review(date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_summary(date,date,date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_spending_breakdown(date,date,date,uuid[],boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_monthly_review(date)', 'EXECUTE'),
  'only authenticated callers can execute dashboard projections'
);

select ok(
  to_regprocedure('public.dashboard_spending(date,date,date)') is null
    and to_regprocedure('public.dashboard_spending(date,date,date,uuid)') is null
    and to_regprocedure('public.dashboard_recent_activity(date,date,date)') is null
    and to_regprocedure('public.dashboard_category_changes(date)') is null
    and to_regprocedure('public.dashboard_balance(date,date,date)') is null,
  'obsolete dashboard projections are absent'
);

select results_eq(
  $$ select income from public.dashboard_monthly_review(current_date) order by month desc limit 1 $$,
  $$ values (10::numeric) $$,
  'the current monthly review excludes future-dated transactions'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000503';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000503"}';

select results_eq(
  $$ select income, expenses from public.dashboard_summary('2026-07-01', null, null) $$,
  $$ values (500000::numeric, 777::numeric) $$,
  'a member reads only its own household summary'
);

select results_eq(
  $$ select category_name, amount from public.dashboard_spending_breakdown('2026-07-01', null, null, null, false) $$,
  $$ values ('Private food'::text, 777::numeric) $$,
  'a member reads only its own household spending'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000502';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502"}';

select is_empty(
  $$ select * from public.dashboard_summary('2026-07-01', null, null) $$,
  'an authenticated non-member cannot read dashboard summary data'
);

select is_empty(
  $$ select * from public.dashboard_spending_breakdown('2026-07-01', null, null, null, false) $$,
  'an authenticated non-member cannot read dashboard spending data'
);

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';

select throws_like(
  $$ select * from public.dashboard_summary('2026-07-01', null, null) $$,
  '%permission denied for function dashboard_summary%',
  'anonymous callers cannot execute dashboard summary'
);

select throws_like(
  $$ select * from public.dashboard_spending_breakdown('2026-07-01', null, null, null, false) $$,
  '%permission denied for function dashboard_spending_breakdown%',
  'anonymous callers cannot execute dashboard spending'
);

select * from finish();
rollback;
