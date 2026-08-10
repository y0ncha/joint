begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(11);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000501', 'dashboard-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000502', 'dashboard-outsider@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000503', 'dashboard-other-owner@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by, opening_balance)
values
  ('00000000-0000-0000-0000-000000000510', 'Dashboard household', '00000000-0000-0000-0000-000000000501', 8000),
  ('00000000-0000-0000-0000-000000000511', 'Other dashboard household', '00000000-0000-0000-0000-000000000503', 999999);

insert into public.categories (id, household_id, name, kind, color)
values
  ('00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000510', 'Salary', 'income', '#ccebef'),
  ('00000000-0000-0000-0000-000000000521', '00000000-0000-0000-0000-000000000510', 'Food', 'expense', '#f8d7d7'),
  ('00000000-0000-0000-0000-000000000522', '00000000-0000-0000-0000-000000000511', 'Private income', 'income', '#ffcff0');

insert into public.subcategories (id, household_id, category_id, name, color)
values
  ('00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000520', 'Pay cheque', '#d9f0fa'),
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000521', 'Meals', '#ffe1e8'),
  ('00000000-0000-0000-0000-000000000532', '00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000522', 'Secret', '#ffbff4');

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
  ('00000000-0000-0000-0000-000000000550', '00000000-0000-0000-0000-000000000510', 'expense', 100, '2026-07-05', '00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000501', '2026-07-05 12:00:00+00', 'Cafe', 'Lunch');

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

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000501';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000501"}';

select results_eq(
  $$ select income, expenses from public.dashboard_summary('2026-07-01', null, null) $$,
  $$ values (16400::numeric, 7940::numeric) $$,
  'summary returns the selected month totals'
);
select is(
  (select shared_balance from public.dashboard_balance('2026-07-01', null, null)),
  18420::numeric,
  'balance includes all earlier household transactions'
);

select results_eq(
  $$ select income_change_percentage, expense_change_percentage from public.dashboard_summary('2026-07-01', null, null) $$,
  $$ values (null::numeric, null::numeric) $$,
  'past month summary does not claim a current-month comparison'
);

select results_eq(
  $$ select expected_monthly_income, expenses from public.dashboard_balance('2026-07-01', null, null) $$,
  $$ values (9000::numeric, 7940::numeric) $$,
  'balance returns only the remaining balance-card totals'
);

select results_eq(
  $$ select category_name, amount from public.dashboard_spending('2026-07-01', null, null) $$,
  $$ values ('Food'::text, 7900::numeric), ('Other'::text, 40::numeric) $$,
  'spending groups selected expenses by parent category'
);

select results_eq(
  $$ select id, category_name, subcategory_name from public.dashboard_recent_activity('2026-07-01', null, null) $$,
  $$ values
    ('00000000-0000-0000-0000-000000000551'::uuid, 'Other'::text, null::text),
    ('00000000-0000-0000-0000-000000000550'::uuid, 'Food'::text, 'Meals'::text),
    ('00000000-0000-0000-0000-000000000549'::uuid, 'Salary'::text, 'Pay cheque'::text),
    ('00000000-0000-0000-0000-000000000548'::uuid, 'Food'::text, 'Meals'::text),
    ('00000000-0000-0000-0000-000000000547'::uuid, 'Food'::text, 'Meals'::text)
  $$,
  'activity returns the newest five selected rows with category labels'
);

select ok(
  (
    select count(*) = 4 and bool_and(not procedure.prosecdef and procedure.provolatile = 's')
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as schema on schema.oid = procedure.pronamespace
    where schema.nspname = 'public'
      and procedure.proname in ('dashboard_summary', 'dashboard_spending', 'dashboard_balance', 'dashboard_recent_activity')
  ),
  'all dashboard projections are stable security-invoker functions'
);

select ok(
  has_function_privilege('authenticated', 'public.dashboard_summary(date,date,date)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.dashboard_spending(date,date,date)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.dashboard_balance(date,date,date)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.dashboard_recent_activity(date,date,date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_summary(date,date,date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_spending(date,date,date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_balance(date,date,date)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.dashboard_recent_activity(date,date,date)', 'EXECUTE'),
  'only authenticated application callers can execute dashboard projections'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000502';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000502"}';

select is_empty(
  $$ select * from public.dashboard_summary('2026-07-01', null, null) $$,
  'an authenticated non-member cannot read dashboard summary data'
);

select is_empty(
  $$ select * from public.dashboard_balance('2026-07-01', null, null) $$,
  'an authenticated non-member cannot read dashboard balance data'
);

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';

select throws_like(
  $$ select * from public.dashboard_recent_activity('2026-07-01', null, null) $$,
  '%permission denied for function dashboard_recent_activity%',
  'anonymous callers cannot execute dashboard projections'
);

select * from finish();
rollback;
