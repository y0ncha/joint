begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(37);

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
    select count(*) = 3 and bool_and(schema_table.relrowsecurity)
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public'
      and schema_table.relname in ('households', 'categories', 'transactions')
  ),
  'RLS is enabled on households, categories, and transactions'
);

select extensions.has_table('public', 'member_card_mappings', 'has member card mappings');

select extensions.ok(
  (
    select schema_table.relrowsecurity
    from pg_catalog.pg_class as schema_table
    join pg_catalog.pg_namespace as table_schema on table_schema.oid = schema_table.relnamespace
    where table_schema.nspname = 'public'
      and schema_table.relname = 'member_card_mappings'
  ),
  'RLS is enabled on member card mappings'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.member_card_mappings', 'SELECT')
    and has_table_privilege('authenticated', 'public.member_card_mappings', 'INSERT')
    and not has_table_privilege('authenticated', 'public.member_card_mappings', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.member_card_mappings', 'DELETE'),
  'authenticated users may only select and insert member card mappings'
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
  ('00000000-0000-0000-0000-000000000404', 'second-member@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by, opening_balance)
values
  ('00000000-0000-0000-0000-000000000410', 'First household', '00000000-0000-0000-0000-000000000401', 1000.00),
  ('00000000-0000-0000-0000-000000000411', 'Second household', '00000000-0000-0000-0000-000000000403', -250.00);

insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', 'member'),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000404', 'member');

select extensions.lives_ok(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000403', '1234')
  $$,
  'the same card suffix may exist in another household'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000401';
set local request.jwt.claim.email = 'first-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000401","email":"first-owner@example.test"}';

select extensions.lives_ok(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000401', '1234')
  $$,
  'a household member can save their own card mapping'
);

select extensions.throws_like(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '5678')
  $$,
  '%row-level security%',
  'a household member cannot save another member card mapping'
);

select extensions.is(
  (select count(*) from public.member_card_mappings where household_id = '00000000-0000-0000-0000-000000000410'),
  1::bigint,
  'a household member can read their household card mappings'
);

select extensions.is(
  (select count(*) from public.member_card_mappings where household_id = '00000000-0000-0000-0000-000000000411'),
  0::bigint,
  'a household member cannot read another household card mappings'
);

select extensions.throws_like(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', '5678')
  $$,
  '%row-level security%',
  'a household member cannot save a mapping in another household'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.throws_like(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000401', '5678')
  $$,
  '%member_card_mappings_pkey%',
  'a household member can have only one card mapping'
);

select extensions.throws_like(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '1234')
  $$,
  '%member_card_mappings_household_id_last_four_key%',
  'a card suffix can map to only one member per household'
);

select extensions.throws_like(
  $$
    insert into public.member_card_mappings (household_id, user_id, last_four)
    values ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000402', '123')
  $$,
  '%member_card_mappings_last_four_check%',
  'a card mapping requires exactly four digits'
);

insert into public.categories (id, household_id, name, kind)
values
  ('00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-000000000410', 'Salary', 'income'),
  ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000410', 'Groceries', 'expense'),
  ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000411', 'Other income', 'income'),
  ('00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000411', 'Other expense', 'expense');

insert into public.transactions (
  id,
  household_id,
  kind,
  amount,
  occurred_on,
  category_id,
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
    '00000000-0000-0000-0000-000000000420',
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
    '00000000-0000-0000-0000-000000000421',
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
      'category_id', category_id,
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
    'category_id', '00000000-0000-0000-0000-000000000420'::uuid,
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
      'category_id', category_id,
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
    'category_id', '00000000-0000-0000-0000-000000000421'::uuid,
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
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000423',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction category must belong to its household%',
  'a transaction category from another household fails'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'income',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000421',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '%Transaction category kind must match transaction kind%',
  'a mismatched category kind fails'
);

select extensions.is(
  (
    select count(*)
    from public.transactions
    where source = 'manual'
      and import_file_hash is null
      and import_row_number is null
  ),
  2::bigint,
  'transactions default to manual without import metadata'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      null,
      '00000000-0000-0000-0000-000000000401',
      null
    )
  $$,
  '%transactions_category_required_check%',
  'a manual transaction requires a category'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (
      household_id,
      kind,
      amount,
      occurred_on,
      category_id,
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
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      7
    )
  $$,
  'an imported transaction may be uncategorized and unassigned'
);

select extensions.lives_ok(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000421',
      '00000000-0000-0000-0000-000000000401',
      null
    )
  $$,
  'a manual transaction may be unassigned'
);

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by, source)
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
      category_id,
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
      '00000000-0000-0000-0000-000000000421',
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
      category_id,
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
      category_id,
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
      category_id,
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
      category_id,
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

select extensions.throws_like(
  $$
    insert into public.transactions (household_id, kind, amount, occurred_on, category_id, created_by, paid_by)
    values (
      '00000000-0000-0000-0000-000000000410',
      'expense',
      10.00,
      date '2026-07-03',
      '00000000-0000-0000-0000-000000000421',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000404'
    )
  $$,
  '%Transaction payer must belong to its household%',
  'a non-member payer fails'
);

select * from extensions.finish();
rollback;
