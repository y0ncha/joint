begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(151);

select extensions.is(
  (select count(*) from public.transactions),
  0::bigint,
  'the Essentials migration resets all financial transactions'
);

select extensions.ok(
  (select count(*) > 0 from public.households)
    and (select count(*) > 0 from public.profiles)
    and (select count(*) > 0 from public.household_members),
  'the Essentials migration preserves existing households, profiles, and memberships'
);

select extensions.ok(
  not exists (
      select 1
      from public.households as household
      where (
        select count(*)
        from public.categories as category
        where category.household_id = household.id
          and (
            (category.system_key = 'bills'
              and category.name = 'Bills'
              and category.kind = 'expense'
              and category.icon = 'receipt'
              and category.archived_at is null)
            or
            (category.system_key = 'groceries'
              and category.name = 'Groceries'
              and category.kind = 'expense'
              and category.icon = 'shopping-basket'
              and category.archived_at is null)
          )
      ) <> 2
    ),
  'the Essentials migration leaves exactly the protected parent seeds for every existing household'
);

select extensions.ok(
  not exists (
      select 1
      from public.households as household
      where (
        select count(*)
        from public.subcategories as subcategory
        join public.categories as category on category.id = subcategory.category_id
        where subcategory.household_id = household.id
          and category.household_id = household.id
          and category.system_key = 'groceries'
          and subcategory.archived_at is null
          and (
            (subcategory.system_key = 'main_run' and subcategory.name = 'Main run')
            or (subcategory.system_key = 'top_ups' and subcategory.name = 'Top-ups')
          )
      ) <> 2
    ),
  'the Essentials migration leaves exactly the protected Groceries children for every existing household'
);

select extensions.hasnt_table('public', 'accounts', 'has no accounts table');
select extensions.hasnt_type('public', 'account_kind', 'has no account kind enum');
select extensions.hasnt_column('public', 'transactions', 'account_id', 'transactions have no source account');
select extensions.hasnt_column('public', 'transactions', 'destination_account_id', 'transactions have no destination account');

select extensions.is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('last_four_digits', 'statement_close_day')
  ),
  0::bigint,
  'has no card metadata'
);

select extensions.is(
  (
    select array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'transaction_kind'
  ),
  array['income', 'expense'],
  'transaction kinds contain exactly income and expense'
);

select extensions.ok(
  (
    select count(*) = 4 and bool_and(schema_table.relrowsecurity)
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public'
      and schema_table.relname in ('households', 'categories', 'subcategories', 'transactions')
  ),
  'RLS is enabled on households, categories, subcategories, and transactions'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.subcategories', 'SELECT')
    and has_table_privilege('authenticated', 'public.subcategories', 'INSERT')
    and has_table_privilege('authenticated', 'public.subcategories', 'UPDATE')
    and has_table_privilege('authenticated', 'public.subcategories', 'DELETE'),
  'authenticated users have CRUD privileges on subcategories'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.subcategories', 'SELECT')
    and not has_table_privilege('anon', 'public.subcategories', 'INSERT')
    and not has_table_privilege('anon', 'public.subcategories', 'UPDATE')
    and not has_table_privilege('anon', 'public.subcategories', 'DELETE')
    and not has_table_privilege('anon', 'public.subcategories', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.subcategories', 'REFERENCES')
    and not has_table_privilege('anon', 'public.subcategories', 'TRIGGER'),
  'anonymous callers have no privileges on subcategories'
);

select extensions.has_table('public', 'member_cards', 'has member cards');

select extensions.ok(
  (
    select schema_table.relrowsecurity
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public'
      and schema_table.relname = 'member_cards'
  ),
  'RLS is enabled on member card mappings'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.member_cards', 'SELECT')
    and has_table_privilege('authenticated', 'public.member_cards', 'INSERT')
    and has_table_privilege('authenticated', 'public.member_cards', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.member_cards', 'DELETE'),
  'authenticated users may select, insert, and update member card mappings'
);

select extensions.is(
  (
    select array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'transaction_source'
  ),
  array['manual', 'statement_import'],
  'transaction sources contain exactly manual and statement import'
);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000401', 'first-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000402', 'first-member@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000403', 'second-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000404', 'second-member@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000405', 'outsider@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by, opening_balance)
values
  ('00000000-0000-0000-0000-000000000410', 'First household', '00000000-0000-0000-0000-000000000401', 1000.00),
  ('00000000-0000-0000-0000-000000000411', 'Second household', '00000000-0000-0000-0000-000000000403', -250.00);

insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', 'member'),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000404', 'member');

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('00000000-0000-0000-0000-000000000410'::uuid),
        ('00000000-0000-0000-0000-000000000411'::uuid)
    ) as expected(household_id)
    where (
      select count(*)
      from public.categories
      where household_id = expected.household_id
        and system_key in ('bills', 'groceries', 'other_income', 'other_expense')
    ) <> 4
      or (
        select count(*)
        from public.categories as category
        where category.household_id = expected.household_id
          and (
            (category.system_key = 'bills'
              and category.name = 'Bills'
              and category.kind = 'expense'
              and category.icon = 'receipt'
              and category.archived_at is null)
            or
            (category.system_key = 'groceries'
              and category.name = 'Groceries'
              and category.kind = 'expense'
              and category.icon = 'shopping-basket'
              and category.archived_at is null)
          )
      ) <> 2
  ),
  'future household provisioning creates both protected parent categories'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('00000000-0000-0000-0000-000000000410'::uuid),
        ('00000000-0000-0000-0000-000000000411'::uuid)
    ) as expected(household_id)
    where (select count(*) from public.subcategories where household_id = expected.household_id) <> 2
      or (
        select count(*)
        from public.subcategories as subcategory
        join public.categories as category on category.id = subcategory.category_id
        where subcategory.household_id = expected.household_id
          and category.system_key = 'groceries'
          and subcategory.archived_at is null
          and (
            (subcategory.system_key = 'main_run' and subcategory.name = 'Main run')
            or (subcategory.system_key = 'top_ups' and subcategory.name = 'Top-ups')
          )
      ) <> 2
  ),
  'future household provisioning creates both protected Groceries children'
);

select extensions.is(
  (
    select count(*)
    from public.household_members
    where (household_id, user_id, role) in (
      (
        '00000000-0000-0000-0000-000000000410'::uuid,
        '00000000-0000-0000-0000-000000000401'::uuid,
        'owner'::public.household_role
      ),
      (
        '00000000-0000-0000-0000-000000000411'::uuid,
        '00000000-0000-0000-0000-000000000403'::uuid,
        'owner'::public.household_role
      )
    )
  ),
  2::bigint,
  'future household provisioning creates each owner membership with its protected taxonomy'
);

select extensions.lives_ok(
  $$
    insert into public.categories (household_id, name, kind)
    values ('00000000-0000-0000-0000-000000000410', 'Generated color', 'expense')
  $$,
  'a new category receives a generated color'
);

select extensions.ok(
  (select color ~ '^#[0-9A-Fa-f]{6}$' from public.categories where household_id = '00000000-0000-0000-0000-000000000410' and name = 'Generated color')
  and (select color ~ '^#[0-9A-Fa-f]{6}$' from public.household_members where household_id = '00000000-0000-0000-0000-000000000410' and user_id = '00000000-0000-0000-0000-000000000402'),
  'omitted category and member colors receive six-digit hex values'
);

select extensions.lives_ok(
  $$
    update public.categories
    set color = '#ccebef'
    where household_id = '00000000-0000-0000-0000-000000000410' and name = 'Generated color'
  $$,
  'a category accepts a palette color'
);

select extensions.is(
  (select color from public.categories where household_id = '00000000-0000-0000-0000-000000000410' and name = 'Generated color'),
  '#ccebef',
  'a selected category color is preserved'
);

select extensions.lives_ok(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000403', '1234')
  $$,
  'the same card suffix may exist in another household'
);

insert into public.member_cards (household_id, user_id, last_four)
values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '5678');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$ select public.save_current_settings(1250.50::numeric) $$,
  'a household owner can set the shared Groceries budget'
);

select extensions.is(
  (select groceries_monthly_budget from public.households where id = '00000000-0000-0000-0000-000000000410'),
  1250.50::numeric,
  'an owner budget update persists exactly'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000402';
set local request.jwt.claim.email = 'first-member@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000402","email":"first-member@example.test"}';

select extensions.lives_ok(
  $$ select public.save_current_settings(900.25::numeric) $$,
  'a non-owner household member can set the shared Groceries budget'
);

select extensions.is(
  (select groceries_monthly_budget from public.households where id = '00000000-0000-0000-0000-000000000410'),
  900.25::numeric,
  'a member budget update persists exactly'
);

select extensions.is_empty(
  $$
    update public.households
    set groceries_monthly_budget = 1
    where id = '00000000-0000-0000-0000-000000000410'
    returning 1
  $$,
  'a non-owner member cannot bypass the settings function to update the budget directly'
);

select extensions.lives_ok(
  $$ select public.save_current_settings(null::numeric, null, null, null, null) $$,
  'a household member can clear the shared Groceries budget'
);

select extensions.is(
  (select groceries_monthly_budget from public.households where id = '00000000-0000-0000-0000-000000000410'),
  null::numeric,
  'clearing the shared Groceries budget persists NULL'
);

select extensions.throws_like(
  $$ select public.save_current_settings(0::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects zero'
);

select extensions.throws_like(
  $$ select public.save_current_settings((-1)::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects negative values'
);

select extensions.throws_like(
  $$ select public.save_current_settings(1.001::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects more than two decimal places'
);

select extensions.throws_like(
  $$ select public.save_current_settings('NaN'::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects NaN'
);

select extensions.throws_like(
  $$ select public.save_current_settings('Infinity'::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects infinity'
);

select extensions.throws_like(
  $$ select public.save_current_settings(10000000000::numeric) $$,
  '%households_groceries_monthly_budget_check%',
  'the shared Groceries budget rejects the exclusive magnitude boundary'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000405';
set local request.jwt.claim.email = 'outsider@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000405","email":"outsider@example.test"}';

select extensions.throws_like(
  $$ select public.save_current_settings(500::numeric) $$,
  '%Not allowed%',
  'an authenticated non-member cannot change a household budget'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000401', '1234')
  $$,
  'a household member can save their own card mapping'
);

select extensions.throws_like(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '5678')
  $$,
  '%row-level security%',
  'a household member cannot save another member card mapping'
);

select extensions.is(
  (select count(*) from public.member_cards where household_id = '00000000-0000-0000-0000-000000000410'),
  2::bigint,
  'a household member can read their household card mappings'
);

select extensions.is(
  (select count(*) from public.member_cards where household_id = '00000000-0000-0000-0000-000000000411'),
  0::bigint,
  'a household member cannot read another household card mappings'
);

select extensions.throws_like(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', '5678')
  $$,
  '%row-level security%',
  'a household member cannot save a mapping in another household'
);

select extensions.lives_ok(
  $$
    update public.member_cards
    set last_four = '4321'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and user_id = '00000000-0000-0000-0000-000000000401'
  $$,
  'a household member can replace their own card mapping'
);

select extensions.is_empty(
  $$
    update public.member_cards
    set last_four = '8765'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and user_id = '00000000-0000-0000-0000-000000000402'
    returning 1
  $$,
  'a household member cannot replace another member mapping in the same household'
);

select extensions.throws_like(
  $$
    update public.member_cards
    set user_id = '00000000-0000-0000-0000-000000000402'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and user_id = '00000000-0000-0000-0000-000000000401'
  $$,
  '%row-level security%',
  'a household member cannot reassign their own card mapping'
);

select extensions.is_empty(
  $$
    update public.member_cards
    set last_four = '8765'
    where household_id = '00000000-0000-0000-0000-000000000411'
      and user_id = '00000000-0000-0000-0000-000000000403'
    returning 1
  $$,
  'a household member cannot replace another household mapping'
);

reset role;
delete from public.member_cards
where household_id = '00000000-0000-0000-0000-000000000410'
  and user_id = '00000000-0000-0000-0000-000000000402';
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.throws_like(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000401', '5678')
  $$,
  '%member_cards_pkey%',
  'a household member can have only one card mapping'
);

select extensions.throws_like(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '4321')
  $$,
  '%member_cards_household_id_last_four_key%',
  'a card suffix can map to only one member per household'
);

select extensions.throws_like(
  $$
    insert into public.member_cards (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '123')
  $$,
  '%member_cards_last_four_check%',
  'a card mapping requires exactly four digits'
);

insert into public.categories (id, household_id, name, kind)
values
  ('00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-000000000410', 'Salary', 'income'),
  ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000410', 'Food', 'expense'),
  ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000411', 'Other income', 'income'),
  ('00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000411', 'Other expense', 'expense');

insert into public.subcategories (id, household_id, category_id, name)
values
  ('00000000-0000-0000-0000-000000000424', '00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000420', 'Salary'),
  ('00000000-0000-0000-0000-000000000425', '00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000421', 'Groceries'),
  ('00000000-0000-0000-0000-000000000426', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000422', 'Other income'),
  ('00000000-0000-0000-0000-000000000427', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000423', 'Other expense');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.throws_like(
  $$
    delete from public.categories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'bills'
  $$,
  '%Essential categories cannot be deleted%',
  'a protected Bills parent cannot be deleted'
);

select extensions.throws_like(
  $$
    update public.categories
    set name = 'Utilities'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'bills'
  $$,
  '%Essential category identity cannot be changed%',
  'a protected Bills parent cannot be renamed'
);

select extensions.throws_like(
  $$
    update public.categories
    set archived_at = now()
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'groceries'
  $$,
  '%Essential category identity cannot be changed%',
  'a protected Groceries parent cannot be archived'
);

select extensions.throws_like(
  $$
    update public.categories
    set system_key = null
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'groceries'
  $$,
  '%Essential category identity cannot be changed%',
  'a protected parent cannot lose its system key'
);

select extensions.lives_ok(
  $$
    update public.categories
    set color = '#ffcff0', icon = 'tag'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'bills'
  $$,
  'a protected parent permits appearance customization'
);

select extensions.throws_like(
  $$
    delete from public.subcategories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'main_run'
  $$,
  '%Essential subcategories cannot be deleted%',
  'a protected Groceries child cannot be deleted'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set name = 'Main shop'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'main_run'
  $$,
  '%Essential subcategory identity cannot be changed%',
  'a protected Groceries child cannot be renamed'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set archived_at = now()
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'top_ups'
  $$,
  '%Essential subcategory identity cannot be changed%',
  'a protected Groceries child cannot be archived'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set category_id = (
      select id
      from public.categories
      where household_id = '00000000-0000-0000-0000-000000000410'
        and system_key = 'bills'
    ), color = null
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'top_ups'
  $$,
  '%Essential subcategory identity cannot be changed%',
  'a protected Groceries child cannot move to another parent'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set system_key = null
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'main_run'
  $$,
  '%Essential subcategory identity cannot be changed%',
  'a protected Groceries child cannot lose its system key'
);

select extensions.lives_ok(
  $$
    update public.subcategories
    set icon = 'tag'
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'main_run'
  $$,
  'a protected Groceries child permits appearance customization'
);

select extensions.throws_like(
  $$
    insert into public.subcategories (household_id, category_id, name)
    select household_id, id, 'Extra groceries'
    from public.categories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'groceries'
  $$,
  '%Groceries accepts only its protected subcategories%',
  'Groceries rejects an additional user-managed child'
);

select extensions.throws_like(
  $$
    insert into public.subcategories (household_id, category_id, name, system_key)
    select household_id, id, 'Main run', 'main_run'
    from public.categories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'bills'
  $$,
  '%Essential grocery subcategories must belong to Groceries%',
  'a protected Groceries system key cannot be forged beneath Bills'
);

select extensions.lives_ok(
  $$
    insert into public.subcategories (id, household_id, category_id, name)
    select
      '00000000-0000-0000-0000-000000000428',
      household_id,
      id,
      'Utilities'
    from public.categories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and system_key = 'bills'
  $$,
  'a household member can create a user-managed Bills child'
);

select extensions.lives_ok(
  $$
    update public.subcategories
    set name = 'Home utilities'
    where id = '00000000-0000-0000-0000-000000000428'
  $$,
  'a household member can rename a user-managed Bills child'
);

select extensions.lives_ok(
  $$
    update public.subcategories
    set category_id = '00000000-0000-0000-0000-000000000421', color = null
    where id = '00000000-0000-0000-0000-000000000428'
  $$,
  'a household member can move a user-managed Bills child to another allowed parent'
);

select extensions.lives_ok(
  $$
    update public.subcategories
    set category_id = (
      select id
      from public.categories
      where household_id = '00000000-0000-0000-0000-000000000410'
        and system_key = 'bills'
    ), color = null
    where id = '00000000-0000-0000-0000-000000000428'
  $$,
  'a household member can move a user-managed child back beneath Bills'
);

select extensions.throws_like(
  $$
    update public.subcategories
    set category_id = (
      select id
      from public.categories
      where household_id = '00000000-0000-0000-0000-000000000410'
        and system_key = 'groceries'
    ), color = null
    where id = '00000000-0000-0000-0000-000000000428'
  $$,
  '%Groceries accepts only its protected subcategories%',
  'a user-managed Bills child cannot move beneath Groceries'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

insert into public.transactions (
  id,
  household_id,
  kind,
  amount,
  occurred_on,
  subcategory_id,
  created_by,
  paid_by,
  note,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000430',
    '00000000-0000-0000-0000-000000000410',
    'income',
    300.00,
    date '2026-07-01',
    '00000000-0000-0000-0000-000000000424',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000402',
    'July salary',
    timestamptz '2026-07-01 08:00:00+00',
    timestamptz '2026-07-01 09:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000431',
    '00000000-0000-0000-0000-000000000410',
    'expense',
    125.50,
    date '2026-07-02',
    '00000000-0000-0000-0000-000000000425',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000401',
    'Weekly shop',
    timestamptz '2026-07-02 08:00:00+00',
    timestamptz '2026-07-02 09:00:00+00'
  );

select extensions.is(
  (
    select household.opening_balance + coalesce(sum(
      case ledger_entry.kind
        when 'income' then ledger_entry.amount
        when 'expense' then -ledger_entry.amount
      end
    ), 0)
    from public.households as household
    left join public.transactions as ledger_entry on ledger_entry.household_id = household.id
    where household.id = '00000000-0000-0000-0000-000000000410'
    group by household.opening_balance
  ),
  1174.50::numeric,
  'shared balance is opening balance plus income minus expenses'
);

select extensions.is(
  (select opening_balance from public.households where id = '00000000-0000-0000-0000-000000000411'),
  -250.00::numeric,
  'a shared opening balance may be negative'
);

select extensions.is(
  (
    select jsonb_build_object(
      'household_id', household_id,
      'amount', amount,
      'occurred_on', occurred_on,
      'subcategory_id', subcategory_id,
      'created_by', created_by,
      'paid_by', paid_by,
      'note', note,
      'created_at', created_at,
      'updated_at', updated_at
    )
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000430'
  ),
  jsonb_build_object(
    'household_id', '00000000-0000-0000-0000-000000000410'::uuid,
    'amount', 300.00::numeric,
    'occurred_on', date '2026-07-01',
    'subcategory_id', '00000000-0000-0000-0000-000000000424'::uuid,
    'created_by', '00000000-0000-0000-0000-000000000401'::uuid,
    'paid_by', '00000000-0000-0000-0000-000000000402'::uuid,
    'note', 'July salary',
    'created_at', timestamptz '2026-07-01 08:00:00+00',
    'updated_at', timestamptz '2026-07-01 09:00:00+00'
  ),
  'income preserves its household, amount, date, category, creator, payer, note, and timestamps'
);

select extensions.is(
  (
    select jsonb_build_object(
      'household_id', household_id,
      'amount', amount,
      'occurred_on', occurred_on,
      'subcategory_id', subcategory_id,
      'created_by', created_by,
      'paid_by', paid_by,
      'note', note,
      'created_at', created_at,
      'updated_at', updated_at
    )
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000431'
  ),
  jsonb_build_object(
    'household_id', '00000000-0000-0000-0000-000000000410'::uuid,
    'amount', 125.50::numeric,
    'occurred_on', date '2026-07-02',
    'subcategory_id', '00000000-0000-0000-0000-000000000425'::uuid,
    'created_by', '00000000-0000-0000-0000-000000000402'::uuid,
    'paid_by', '00000000-0000-0000-0000-000000000401'::uuid,
    'note', 'Weekly shop',
    'created_at', timestamptz '2026-07-02 08:00:00+00',
    'updated_at', timestamptz '2026-07-02 09:00:00+00'
  ),
  'expense preserves its household, amount, date, category, creator, payer, note, and timestamps'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000427',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction subcategory must belong to its household%',
  'a transaction subcategory from another household fails'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'income',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction category kind must match transaction kind%',
  'a mismatched category kind fails'
);

update public.subcategories
set archived_at = now()
where id = '00000000-0000-0000-0000-000000000425';

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction category cannot be archived%',
  'an archived subcategory cannot be assigned to a transaction'
);

update public.subcategories
set archived_at = null
where id = '00000000-0000-0000-0000-000000000425';

update public.categories
set archived_at = now()
where id = '00000000-0000-0000-0000-000000000421';

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction category cannot be archived%',
  'a subcategory under an archived category cannot be assigned to a transaction'
);

update public.categories
set archived_at = null
where id = '00000000-0000-0000-0000-000000000421';

select extensions.is(
  (
    select count(*)
    from public.transactions
    where household_id = '00000000-0000-0000-0000-000000000410'
      and source = 'manual'
      and import_file_hash is null
      and import_row_number is null
  ),
  2::bigint,
  'transactions default to manual without import metadata'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (
      id,
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      service_period_start,
      service_period_end
    )
    values (
      '00000000-0000-0000-0000-000000000433',
      '00000000-0000-0000-0000-000000000410',
      'expense',
      60.00,
      date '2026-07-31',
      '00000000-0000-0000-0000-000000000428',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401',
      date '2024-01-01',
      date '2024-12-31'
    )
  $$,
  'a Bills transaction accepts an inclusive 366-day service period'
);

select extensions.is(
  (
    select jsonb_build_object(
      'amount', amount,
      'occurred_on', occurred_on,
      'service_period_start', service_period_start,
      'service_period_end', service_period_end
    )
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000433'
  ),
  jsonb_build_object(
    'amount', 60.00::numeric,
    'occurred_on', date '2026-07-31',
    'service_period_start', date '2024-01-01',
    'service_period_end', date '2024-12-31'
  ),
  'a Bills service period does not change its stored amount or posting date'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000428',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Bills transactions require a service period%',
  'a Bills transaction rejects a missing service period'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by,
      service_period_start
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000428',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401',
      date '2026-07-01'
    )
  $$,
  '%Bills transactions require a service period%',
  'a Bills transaction rejects an unpaired service period'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by,
      service_period_start, service_period_end
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000428',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401',
      date '2026-08-01',
      date '2026-07-31'
    )
  $$,
  '%transactions_service_period_order_check%',
  'a Bills transaction rejects a reversed service period'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by,
      service_period_start, service_period_end
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000428',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401',
      date '2024-01-01',
      date '2025-01-01'
    )
  $$,
  '%transactions_service_period_length_check%',
  'a Bills transaction rejects a service period longer than 366 inclusive days'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by,
      service_period_start, service_period_end
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401',
      date '2026-07-01',
      date '2026-07-31'
    )
  $$,
  '%Only Bills transactions can have a service period%',
  'a non-Bills transaction rejects a service period'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (
      id,
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000432',
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      7
    )
  $$,
  'an imported transaction may be uncategorized and unassigned'
);

select extensions.throws_like(
  $$
    update public.transactions
    set subcategory_id = '00000000-0000-0000-0000-000000000428'
    where id = '00000000-0000-0000-0000-000000000432'
  $$,
  '%Bills transactions require a service period%',
  'assigning an imported transaction to Bills requires a service period'
);

select extensions.lives_ok(
  $$
    update public.transactions
    set
      subcategory_id = '00000000-0000-0000-0000-000000000428',
      service_period_start = date '2026-07-01',
      service_period_end = date '2026-07-31'
    where id = '00000000-0000-0000-0000-000000000432'
  $$,
  'an imported transaction can be assigned to Bills with a service period'
);

select extensions.is(
  (
    select jsonb_build_object(
      'source', source,
      'import_file_hash', import_file_hash,
      'import_row_number', import_row_number
    )
    from public.transactions
    where id = '00000000-0000-0000-0000-000000000432'
  ),
  jsonb_build_object(
    'source', 'statement_import'::public.transaction_source,
    'import_file_hash', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::text,
    'import_row_number', 7
  ),
  'Bills assignment preserves statement-import provenance'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      null
    )
  $$,
  'a manual transaction may be unassigned'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by, source)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import'
    )
  $$,
  '%transactions_import_metadata_check%',
  'an imported transaction requires import metadata'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      null,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      8
    )
  $$,
  '%transactions_import_metadata_check%',
  'a manual transaction cannot carry import metadata'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import',
      'NOT-A-SHA-256-DIGEST',
      8
    )
  $$,
  '%transactions_import_metadata_check%',
  'an imported transaction requires a lowercase SHA-256 digest'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      0
    )
  $$,
  '%transactions_import_metadata_check%',
  'an imported transaction requires a positive source row number'
);

select extensions.throws_like(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'income',
      10.00,
      date '2026-07-04',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      7
    )
  $$,
  '%transactions_import_file_row_unique_idx%',
  'an imported file row cannot be inserted twice in one household'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000411',
      'income',
      10.00,
      date '2026-07-04',
      null,
      '00000000-0000-0000-0000-000000000403',
      null,
      'statement_import',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      7
    )
  $$,
  'the same imported file row may exist in another household'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$
    delete from public.subcategories
    where id = '00000000-0000-0000-0000-000000000428'
  $$,
  'a household member can delete a user-managed Bills child'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.ok(
  (
    select count(*) = 2
      and bool_and(subcategory_id is null)
      and bool_and(service_period_start is null)
      and bool_and(service_period_end is null)
    from public.transactions
    where id in (
      '00000000-0000-0000-0000-000000000432',
      '00000000-0000-0000-0000-000000000433'
    )
  ),
  'deleting a Bills child uncategorizes linked transactions and clears their service periods'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000425',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000404'
    )
  $$,
  '%Transaction payer must belong to its household%',
  'a non-member payer fails'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-05',
      null,
      '00000000-0000-0000-0000-000000000401',
      null
    )
  $$,
  '%row-level security%',
  'an authenticated member cannot directly insert an uncategorized manual transaction'
);

select extensions.throws_like(
  $$
    update public.transactions
    set subcategory_id = null
    where id = '00000000-0000-0000-0000-000000000431'
  $$,
  '%row-level security%',
  'an authenticated member cannot directly uncategorize a manual transaction'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      subcategory_id,
      created_by,
      paid_by,
      source,
      import_file_hash,
      import_row_number
    )
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-05',
      null,
      '00000000-0000-0000-0000-000000000401',
      null,
      'statement_import',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      9
    )
  $$,
  'an authenticated import may remain uncategorized'
);

select extensions.lives_ok(
  $$ select public.create_category('Deployed family', 'expense', null, 'tag') $$,
  'a household member can create a category through the deployed function'
);

select extensions.lives_ok(
  $$
    insert into public.subcategories (household_id, category_id, name)
    select
      '00000000-0000-0000-0000-000000000410',
      category.id,
      child.name
    from public.categories as category
    cross join (values ('First child'), ('Second child')) as child(name)
    where category.household_id = '00000000-0000-0000-0000-000000000410'
      and category.name = 'Deployed family'
  $$,
  'a household member can create children in their household'
);

select extensions.throws_like(
  $$
    insert into public.subcategories (household_id, category_id, name)
    values (
      '00000000-0000-0000-0000-000000000411',
      '00000000-0000-0000-0000-000000000423',
      'Cross-household child'
    )
  $$,
  '%row-level security%',
  'a household member cannot create a child in another household'
);

select extensions.is(
  (select count(*) from public.subcategories where household_id = '00000000-0000-0000-0000-000000000411'),
  0::bigint,
  'a household member cannot select children from another household'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.ok(
  (
    select cardinality(private.category_subcategory_colors(category.color)) > 0
    from public.categories as category
    where category.household_id = '00000000-0000-0000-0000-000000000410'
      and category.name = 'Deployed family'
  ),
  'a function-created category uses a registered category color'
);

select extensions.ok(
  (
    select count(*) = 2
      and bool_and(lower(subcategory.color) = any(private.category_subcategory_colors(category.color)))
    from public.categories as category
    join public.subcategories as subcategory on subcategory.category_id = category.id
    where category.household_id = '00000000-0000-0000-0000-000000000410'
      and category.name = 'Deployed family'
  ),
  'function-colored children belong to their parent category color family'
);

insert into public.transactions (id, household_id, kind, amount, occurred_on, subcategory_id, created_by, paid_by)
select
  '00000000-0000-0000-0000-000000000440',
  category.household_id,
  'expense',
  10.00,
  date '2026-07-05',
  subcategory.id,
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000401'
from public.categories as category
join public.subcategories as subcategory on subcategory.category_id = category.id
where category.household_id = '00000000-0000-0000-0000-000000000410'
  and category.name = 'Deployed family'
  and subcategory.name = 'First child';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$
    delete from public.categories
    where household_id = '00000000-0000-0000-0000-000000000410'
      and name = 'Deployed family'
  $$,
  'a household member can delete their category'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.ok(
  not exists (
    select 1
    from public.subcategories
    where name in ('First child', 'Second child')
      and household_id = '00000000-0000-0000-0000-000000000410'
  )
    and (
      select subcategory_id is null
      from public.transactions
      where id = '00000000-0000-0000-0000-000000000440'
    ),
  'deleting a category removes its children and uncategorizes linked transactions'
);

set local role anon;

select extensions.throws_like(
  $$ select public.set_current_household_member_color('#dcecf2') $$,
  '%permission denied%',
  'an anonymous caller cannot change a member color'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000405';
set local request.jwt.claim.email = 'outsider@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000405","email":"outsider@example.test"}';

select extensions.throws_like(
  $$ select public.set_current_household_member_color('#dcecf2') $$,
  '%Not allowed%',
  'an authenticated non-member cannot change a member color'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$ select public.set_current_household_member_color('#dcece3') $$,
  'a household member can change their own color'
);

select extensions.is(
  (select color from public.household_members where household_id = '00000000-0000-0000-0000-000000000410' and user_id = '00000000-0000-0000-0000-000000000401'),
  '#dcece3',
  'a current member color update persists'
);

select extensions.is(
  (select color from public.household_members where household_id = '00000000-0000-0000-0000-000000000410' and user_id = '00000000-0000-0000-0000-000000000402'),
  '#dcecf2',
  'a current member color update leaves the partner unchanged'
);

select extensions.lives_ok(
  $$ select public.set_current_household_member_color('#0f6b54') $$,
  'a household member can select a non-palette hex color'
);

select extensions.is(
  (select color from public.household_members where household_id = '00000000-0000-0000-0000-000000000410' and user_id = '00000000-0000-0000-0000-000000000401'),
  '#0f6b54',
  'a non-palette member color persists'
);

select extensions.throws_like(
  $$ select public.set_current_household_member_color('blue') $$,
  '%Invalid color%',
  'a household member cannot select an invalid color'
);

select extensions.lives_ok(
  $$ select public.save_current_settings('Ada Updated', 'Updated household', '#dcecf2', null) $$,
  'an owner can save all settings atomically'
);

select extensions.is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000401'),
  'Ada Updated',
  'an atomic settings save updates the current profile'
);

select extensions.is(
  (select name from public.households where id = '00000000-0000-0000-0000-000000000410'),
  'Updated household',
  'an atomic settings save updates the owned household'
);

select extensions.throws_like(
  $$ select public.save_current_settings('Should roll back', null, 'blue', null) $$,
  '%Invalid color%',
  'an invalid later settings value aborts the whole save'
);

select extensions.is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000401'),
  'Ada Updated',
  'a failed atomic settings save does not persist earlier updates'
);

reset role;

select extensions.ok(
  not has_function_privilege('anon', 'public.assign_category_color()', 'EXECUTE'),
  'anon cannot execute the category-color trigger function'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.assign_category_color()', 'EXECUTE'),
  'authenticated users cannot execute the category-color trigger function'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.assign_household_member_color()', 'EXECUTE'),
  'anon cannot execute the member-color trigger function'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.assign_household_member_color()', 'EXECUTE'),
  'authenticated users cannot execute the member-color trigger function'
);

select extensions.has_column(
  'public',
  'categories',
  'system_key',
  'categories expose a stable protected system key'
);

select extensions.has_column(
  'public',
  'subcategories',
  'system_key',
  'subcategories expose a stable protected system key'
);

select extensions.has_column(
  'public',
  'transactions',
  'service_period_start',
  'transactions expose a service-period start'
);

select extensions.has_column(
  'public',
  'transactions',
  'service_period_end',
  'transactions expose a service-period end'
);

select extensions.has_column(
  'public',
  'households',
  'groceries_monthly_budget',
  'households expose the optional Groceries budget'
);

select extensions.ok(
  (
    select attribute.atttypid = 'numeric'::regtype
      and attribute.atttypmod = -1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.households'::regclass
      and attribute.attname = 'groceries_monthly_budget'
      and not attribute.attisdropped
  ),
  'the Groceries budget uses unconstrained numeric storage'
);

select extensions.is(
  (
    select array_agg(constraint_meta.conname::text order by constraint_meta.conname)
    from pg_catalog.pg_constraint as constraint_meta
    where constraint_meta.conrelid in (
      'public.categories'::regclass,
      'public.subcategories'::regclass,
      'public.transactions'::regclass,
      'public.households'::regclass
    )
      and constraint_meta.conname in (
        'categories_system_key_check',
        'subcategories_system_key_check',
        'transactions_service_period_pair_check',
        'transactions_service_period_order_check',
        'transactions_service_period_length_check',
        'households_groceries_monthly_budget_check'
      )
  ),
  array[
    'categories_system_key_check',
    'households_groceries_monthly_budget_check',
    'subcategories_system_key_check',
    'transactions_service_period_length_check',
    'transactions_service_period_order_check',
    'transactions_service_period_pair_check'
  ],
  'all planned Essentials check constraints are present'
);

select extensions.ok(
  (
    select count(*) = 3
      and bool_and(index_meta.indisvalid)
      and bool_and(index_meta.indisready)
      and bool_and(index_meta.indpred is not null)
      and count(*) filter (
        where index_relation.relname in (
          'categories_household_system_key_key',
          'subcategories_household_system_key_key'
        )
          and index_meta.indisunique
      ) = 2
    from pg_catalog.pg_index as index_meta
    join pg_catalog.pg_class as index_relation on index_relation.oid = index_meta.indexrelid
    join pg_catalog.pg_namespace as index_schema on index_schema.oid = index_relation.relnamespace
    where index_schema.nspname = 'public'
      and index_relation.relname in (
        'categories_household_system_key_key',
        'subcategories_household_system_key_key',
        'transactions_household_service_period_idx'
      )
  ),
  'the planned partial Essentials indexes are valid, ready, and uniquely scoped where required'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_index as index_meta
    join pg_catalog.pg_class as index_relation on index_relation.oid = index_meta.indexrelid
    join pg_catalog.pg_namespace as index_schema on index_schema.oid = index_relation.relnamespace
    where index_schema.nspname = 'public'
      and index_relation.relname = 'transactions_household_service_period_idx'
      and pg_get_indexdef(index_meta.indexrelid) =
        'CREATE INDEX transactions_household_service_period_idx ON public.transactions USING btree (household_id, service_period_start, service_period_end) WHERE ((service_period_start IS NOT NULL) AND (service_period_end IS NOT NULL))'
  ),
  'transactions have the planned household service-period overlap index'
);

select extensions.ok(
  (
    select count(*) = 4
    from pg_catalog.pg_trigger as trigger_meta
    where not trigger_meta.tgisinternal
      and (
        (
          trigger_meta.tgrelid = 'public.categories'::regclass
          and trigger_meta.tgname = 'categories_protect_essential_identity'
          and trigger_meta.tgfoid = 'private.protect_essential_category()'::regprocedure
        )
        or (
          trigger_meta.tgrelid = 'public.subcategories'::regclass
          and trigger_meta.tgname = 'subcategories_protect_essential_identity'
          and trigger_meta.tgfoid = 'private.protect_essential_subcategory()'::regprocedure
        )
        or (
          trigger_meta.tgrelid = 'public.transactions'::regclass
          and trigger_meta.tgname = 'transactions_validate_subcategory'
          and trigger_meta.tgfoid = 'private.validate_transaction_subcategory()'::regprocedure
        )
        or (
          trigger_meta.tgrelid = 'public.households'::regclass
          and trigger_meta.tgname = 'on_household_created'
          and trigger_meta.tgfoid = 'public.add_household_owner()'::regprocedure
        )
      )
  ),
  'the planned protection, validation, and future-provisioning triggers are present'
);

select extensions.ok(
  (
    select count(*) = 6
      and bool_and(coalesce(function_meta.proconfig, array[]::text[]) @> array['search_path=""'])
      and count(*) filter (where function_meta.prosecdef) = 2
    from pg_catalog.pg_proc as function_meta
    where function_meta.oid = any(array[
      'private.protect_essential_category()'::regprocedure,
      'private.protect_essential_subcategory()'::regprocedure,
      'private.seed_essential_categories(uuid)'::regprocedure,
      'private.validate_transaction_subcategory()'::regprocedure,
      'public.add_household_owner()'::regprocedure,
      'public.save_current_settings(numeric,text,text,text,text)'::regprocedure
    ])
  ),
  'Essentials functions pin an empty search path and only trusted entry points are security definers'
);

select extensions.ok(
  (
    select bool_and(
      not has_function_privilege('anon', function_meta.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', function_meta.oid, 'EXECUTE')
    )
    from pg_catalog.pg_proc as function_meta
    where function_meta.oid = any(array[
      'private.protect_essential_category()'::regprocedure,
      'private.protect_essential_subcategory()'::regprocedure,
      'private.seed_essential_categories(uuid)'::regprocedure,
      'private.validate_transaction_subcategory()'::regprocedure
    ])
  ),
  'application roles cannot execute private Essentials trigger helpers'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.save_current_settings(numeric,text,text,text,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.save_current_settings(numeric,text,text,text,text)',
      'EXECUTE'
    ),
  'only authenticated callers can execute the Groceries-budget settings function'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.households', 'SELECT')
    and not has_table_privilege('anon', 'public.categories', 'SELECT')
    and not has_table_privilege('anon', 'public.subcategories', 'SELECT')
    and not has_table_privilege('anon', 'public.transactions', 'SELECT'),
  'anonymous callers cannot read any Essentials household data'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_index as index_meta
    join pg_catalog.pg_class as index_relation on index_relation.oid = index_meta.indexrelid
    join pg_catalog.pg_namespace as index_schema on index_schema.oid = index_relation.relnamespace
    where index_schema.nspname = 'public'
      and index_relation.relname = 'transactions_household_subcategory_idx'
      and index_meta.indisvalid
      and index_meta.indisready
      and index_meta.indpred is not null
      and pg_get_indexdef(index_meta.indexrelid) =
        'CREATE INDEX transactions_household_subcategory_idx ON public.transactions USING btree (household_id, subcategory_id) WHERE (subcategory_id IS NOT NULL)'
  ),
  'transactions have a valid partial household-subcategory index'
);

select extensions.has_table('public', 'automation_rules', 'has household-owned automation rules');

select extensions.ok(
  (
    select schema_table.relrowsecurity
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public' and schema_table.relname = 'automation_rules'
  ),
  'automation rules enforce RLS'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.automation_rules', 'SELECT')
    and has_table_privilege('authenticated', 'public.automation_rules', 'INSERT')
    and has_table_privilege('authenticated', 'public.automation_rules', 'UPDATE')
    and has_table_privilege('authenticated', 'public.automation_rules', 'DELETE')
    and not has_table_privilege('anon', 'public.automation_rules', 'SELECT'),
  'only authenticated callers receive automation-rule table access'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_meta
    where constraint_meta.conrelid = 'public.automation_rules'::regclass
      and constraint_meta.conname = 'automation_rules_household_position_key'
      and constraint_meta.contype = 'u'
      and constraint_meta.condeferrable
  ),
  'automation rule priority is unique per household'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_trigger as trigger_meta
    where trigger_meta.tgrelid = 'public.automation_rules'::regclass
      and trigger_meta.tgname = 'automation_rules_validate_destination'
      and trigger_meta.tgfoid = 'private.validate_automation_rule()'::regprocedure
  )
  and exists (
    select 1 from pg_catalog.pg_trigger as trigger_meta
    where trigger_meta.tgrelid = 'public.subcategories'::regclass
      and trigger_meta.tgname = 'subcategories_protect_automation_destinations'
      and trigger_meta.tgfoid = 'private.protect_automation_rule_destinations()'::regprocedure
  ),
  'automation destinations are validated and cannot become Bills'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_proc as function_meta
    where function_meta.oid = 'public.reorder_automation_rules(uuid,uuid[])'::regprocedure
      and coalesce(function_meta.proconfig, array[]::text[]) @> array['search_path=""']
      and not function_meta.prosecdef
  )
  and exists (
    select 1 from pg_catalog.pg_proc as function_meta
    where function_meta.oid = 'public.apply_automation_results(uuid,jsonb)'::regprocedure
      and coalesce(function_meta.proconfig, array[]::text[]) @> array['search_path=""']
      and not function_meta.prosecdef
  ),
  'automation RPCs use invoker rights and pin an empty search path'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.reorder_automation_rules(uuid,uuid[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.apply_automation_results(uuid,jsonb)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reorder_automation_rules(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('anon', 'public.apply_automation_results(uuid,jsonb)', 'EXECUTE'),
  'only authenticated callers can invoke automation RPCs'
);

select extensions.ok(
  exists (
    select 1 from pg_catalog.pg_trigger as trigger_meta
    where trigger_meta.tgrelid = 'public.categories'::regclass
      and trigger_meta.tgname = 'categories_protect_automation_destinations'
      and trigger_meta.tgfoid = 'private.protect_automation_rule_destinations()'::regprocedure
  ),
  'archiving a referenced automation destination is blocked'
);

set local role anon;

select extensions.ok(
  not has_table_privilege('anon', 'public.transactions', 'select'),
  'anonymous callers cannot select transactions'
);

reset role;
select * from extensions.finish();
rollback;
