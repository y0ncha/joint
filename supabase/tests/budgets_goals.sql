begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select extensions.plan(46);

select extensions.has_table('public', 'savings_goals', 'has manual savings goals');

select extensions.has_column(
  'public',
  'categories',
  'monthly_budget',
  'categories expose a current monthly budget'
);

select extensions.has_column(
  'public',
  'subcategories',
  'monthly_budget',
  'subcategories expose a current monthly budget'
);

select extensions.hasnt_column(
  'public',
  'households',
  'groceries_monthly_budget',
  'the obsolete household Groceries budget is removed'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.categories'::regclass
      and attribute.attname = 'monthly_budget'
      and attribute.atttypid = 'numeric'::regtype
      and attribute.atttypmod = -1
      and not attribute.attnotnull
      and not attribute.attisdropped
  ),
  'the migrated Groceries destination uses nullable unconstrained numeric storage'
);

-- The migration's transaction-block parity assertion compares every legacy
-- household value before dropping the source column. Post-migration pgTAP can
-- verify the destination catalog and row shape, but cannot read the dropped
-- source value a second time.
select extensions.ok(
  (
    select count(*)
    from public.households
  ) = (
    select count(*)
    from public.categories
    where system_key = 'groceries'
      and kind = 'expense'
      and archived_at is null
  ),
  'every household has one protected expense Groceries destination for migrated budget values'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_monthly_budget_check'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_monthly_budget_kind_check'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.subcategories'::regclass
      and conname = 'subcategories_monthly_budget_check'
  ),
  'budget amount and category-kind constraints are installed'
);

select extensions.ok(
  (
    select schema_table.relrowsecurity
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema
      on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public'
      and schema_table.relname = 'savings_goals'
  ),
  'savings goals enforce row-level security'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.savings_goals', 'SELECT')
    and has_table_privilege('authenticated', 'public.savings_goals', 'INSERT')
    and has_table_privilege('authenticated', 'public.savings_goals', 'UPDATE')
    and has_table_privilege('authenticated', 'public.savings_goals', 'DELETE')
    and not has_table_privilege('anon', 'public.savings_goals', 'SELECT')
    and not has_table_privilege('anon', 'public.savings_goals', 'INSERT')
    and not has_table_privilege('anon', 'public.savings_goals', 'UPDATE')
    and not has_table_privilege('anon', 'public.savings_goals', 'DELETE'),
  'authenticated has savings-goal CRUD while anon has none'
);

select extensions.ok(
  not exists (
    select 1
    from pg_catalog.pg_class as schema_table
    cross join lateral aclexplode(
      coalesce(schema_table.relacl, acldefault('r', schema_table.relowner))
    ) as table_acl
    where schema_table.oid = 'public.savings_goals'::regclass
      and table_acl.grantee = 0::oid
  ),
  'the public role has no explicit or default savings-goal table privilege'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_index as index_meta
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_meta.indexrelid
    where index_meta.indrelid = 'public.savings_goals'::regclass
      and index_relation.relname = 'savings_goals_household_target_date_idx'
      and index_meta.indisvalid
      and index_meta.indisready
  ),
  'savings goals have a household and target-date index'
);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000901', 'budget-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000902', 'budget-member@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000903', 'budget-outsider@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000904', 'budget-other-owner@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by, opening_balance)
values
  ('00000000-0000-0000-0000-000000000910', 'Budget household', '00000000-0000-0000-0000-000000000901', 0),
  ('00000000-0000-0000-0000-000000000911', 'Other budget household', '00000000-0000-0000-0000-000000000904', 0);

insert into public.household_members (household_id, user_id, role)
values ('00000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000902', 'member');

insert into public.categories (id, household_id, name, kind, color)
values
  ('00000000-0000-0000-0000-000000000920', '00000000-0000-0000-0000-000000000910', 'Budgeted parent', 'expense', '#ccebef'),
  ('00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000910', 'Budgeted income', 'income', '#f8d7d7'),
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000911', 'Other parent', 'expense', '#d9f0fa');

insert into public.subcategories (id, household_id, category_id, name, color)
values
  ('00000000-0000-0000-0000-000000000930', '00000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000920', 'Budgeted child', '#ffe1e8'),
  ('00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000921', 'Income child', '#ffe1e8'),
  ('00000000-0000-0000-0000-000000000932', '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000922', 'Other child', '#ffe1e8');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000902';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000902"}';

select extensions.lives_ok(
  $$
    update public.categories
    set monthly_budget = 1000.00
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  'a household member can set a parent category budget'
);

select extensions.lives_ok(
  $$
    update public.subcategories
    set monthly_budget = 300.00
    where id = '00000000-0000-0000-0000-000000000930'
  $$,
  'a household member can set a child category budget'
);

select extensions.results_eq(
  $$
    select category.monthly_budget, subcategory.monthly_budget
    from public.categories as category
    join public.subcategories as subcategory
      on subcategory.category_id = category.id
    where category.id = '00000000-0000-0000-0000-000000000920'
      and subcategory.id = '00000000-0000-0000-0000-000000000930'
  $$,
  $$ values (1000.00::numeric, 300.00::numeric) $$,
  'parent and child budgets remain independently stored when they overlap'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 0
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects zero'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = (-1)::numeric
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects negative values'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 1.001::numeric
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects more than two decimal places'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 'NaN'::numeric
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects NaN'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 'Infinity'::numeric
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects infinity'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 10000000000::numeric
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%categories_monthly_budget_check%',
  'a category budget rejects the exclusive magnitude boundary'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set monthly_budget = 0::numeric
    where id = '00000000-0000-0000-0000-000000000930'
  $$,
  '%subcategories_monthly_budget_check%',
  'a subcategory budget rejects zero'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set monthly_budget = 1.001::numeric
    where id = '00000000-0000-0000-0000-000000000930'
  $$,
  '%subcategories_monthly_budget_check%',
  'a subcategory budget rejects more than two decimal places'
);

select extensions.throws_like(
  $$
    update public.categories
    set monthly_budget = 25.00
    where id = '00000000-0000-0000-0000-000000000921'
  $$,
  '%categories_monthly_budget_kind_check%',
  'income categories cannot receive budgets'
);

select extensions.lives_ok(
  $$
    update public.categories
    set monthly_budget = null
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  'a category budget can be cleared before a kind transition'
);

select extensions.throws_like(
  $$
    update public.categories
    set kind = 'income'
    where id = '00000000-0000-0000-0000-000000000920'
  $$,
  '%A category with budgeted children must remain an expense%',
  'an expense category with a budgeted child cannot become income'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set monthly_budget = 25.00
    where id = '00000000-0000-0000-0000-000000000931'
  $$,
  '%expense parent%',
  'a subcategory budget requires an expense parent'
);

select extensions.is_empty(
  $$
    update public.categories
    set monthly_budget = 50.00
    where id = '00000000-0000-0000-0000-000000000922'
    returning id
  $$,
  'a member cannot update a budget in another household'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000960', '00000000-0000-0000-0000-000000000910', 'Zero target', 0, 0, current_date)
  $$,
  '%savings_goals_target_amount_check%',
  'a savings goal rejects a zero target'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000961', '00000000-0000-0000-0000-000000000910', 'Negative target', -1, 0, current_date)
  $$,
  '%savings_goals_target_amount_check%',
  'a savings goal rejects a negative target'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000962', '00000000-0000-0000-0000-000000000910', 'Precise target', 1.001, 0, current_date)
  $$,
  '%savings_goals_target_amount_check%',
  'a savings goal rejects a target with more than two decimal places'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000963', '00000000-0000-0000-0000-000000000910', 'Infinite target', 'Infinity'::numeric, 0, current_date)
  $$,
  '%savings_goals_target_amount_check%',
  'a savings goal rejects an infinite target'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000964', '00000000-0000-0000-0000-000000000910', 'Negative saved', 10, -1, current_date)
  $$,
  '%savings_goals_saved_amount_check%',
  'a savings goal rejects a negative saved amount'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000965', '00000000-0000-0000-0000-000000000910', 'Precise saved', 10, 1.001, current_date)
  $$,
  '%savings_goals_saved_amount_check%',
  'a savings goal rejects a saved amount with more than two decimal places'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000966', '00000000-0000-0000-0000-000000000910', 'Blank name', 10, 0, current_date)
  $$,
  '%savings_goals_name_check%',
  'a savings goal rejects a blank name'
);

select extensions.lives_ok(
  $$
    insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000967', '00000000-0000-0000-0000-000000000910', 'Emergency reserve', 1000.00, 200.00, current_date + 30)
  $$,
  'a household member can create a savings goal'
);

select extensions.results_eq(
  $$
    select name, target_amount, saved_amount
    from public.savings_goals
    where id = '00000000-0000-0000-0000-000000000967'
  $$,
  $$ values ('Emergency reserve'::text, 1000.00::numeric, 200.00::numeric) $$,
  'a created savings goal preserves its positive target and nonnegative saved amount'
);

select extensions.lives_ok(
  $$
    update public.savings_goals
    set saved_amount = 1200.00
    where id = '00000000-0000-0000-0000-000000000967'
  $$,
  'a savings goal permits saved amounts above the target'
);

select extensions.is(
  (
    select saved_amount
    from public.savings_goals
    where id = '00000000-0000-0000-0000-000000000967'
  ),
  1200.00::numeric,
  'overfunding preserves the actual saved amount'
);

set local role postgres;

insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, target_date)
values ('00000000-0000-0000-0000-000000000968', '00000000-0000-0000-0000-000000000911', 'Other reserve', 500.00, 50.00, current_date + 60);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000902';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000902"}';

select extensions.is(
  (
    select count(*)
    from public.savings_goals
    where household_id = '00000000-0000-0000-0000-000000000910'
  ),
  1::bigint,
  'a household member reads only goals in their household'
);

select extensions.is_empty(
  $$ select id from public.savings_goals where id = '00000000-0000-0000-0000-000000000968' $$,
  'a household member cannot read another household goal'
);

select extensions.is_empty(
  $$
    update public.savings_goals
    set saved_amount = 100.00
    where id = '00000000-0000-0000-0000-000000000968'
    returning id
  $$,
  'a household member cannot update another household goal'
);

select extensions.is_empty(
  $$
    delete from public.savings_goals
    where id = '00000000-0000-0000-0000-000000000968'
    returning id
  $$,
  'a household member cannot delete another household goal'
);

select extensions.results_eq(
  $$
    delete from public.savings_goals
    where id = '00000000-0000-0000-0000-000000000967'
    returning id
  $$,
  $$ values ('00000000-0000-0000-0000-000000000967'::uuid) $$,
  'a household member can delete a goal in their household'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000903';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903"}';

select extensions.is_empty(
  $$ select id from public.savings_goals where household_id = '00000000-0000-0000-0000-000000000910' $$,
  'an authenticated non-member cannot read savings goals'
);

select extensions.throws_like(
  $$
    insert into public.savings_goals (household_id, name, target_amount, saved_amount, target_date)
    values ('00000000-0000-0000-0000-000000000910', 'Outsider goal', 10, 0, current_date)
  $$,
  '%row-level security%',
  'an authenticated non-member cannot create a savings goal'
);

set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';

select extensions.throws_like(
  $$ select * from public.savings_goals $$,
  '%permission denied for table savings_goals%',
  'anonymous callers cannot read savings goals'
);

reset role;

select * from extensions.finish();
rollback;
