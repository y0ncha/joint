begin;

create extension if not exists pgtap with schema extensions;

create function pg_temp.scalar_or_error(query_text text)
returns text
language plpgsql
as $$
declare
  value text;
begin
  execute query_text into value;
  return value;
exception
  when others then
    return format('ERROR %s: %s', sqlstate, sqlerrm);
end;
$$;

select extensions.plan(42);

select extensions.hasnt_table('private', 'app_access', 'has no global app-access registry');
select extensions.hasnt_table('public', 'household_partner_authorizations', 'has no second partner-authorization table');
select extensions.hasnt_function('public', 'before_user_created_app_access', array['jsonb'], 'has no privileged Auth Hook');
select extensions.hasnt_function('public', 'current_user_has_app_access', array[]::text[], 'has no privileged app-access lookup');

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000301', 'owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000302', 'partner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000303', 'wrong@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000304', 'third@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000305', 'replacement@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000306', 'other-owner@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000307', 'cross@example.test', now(), '{"provider":"google"}'),
  ('00000000-0000-0000-0000-000000000308', 'unmatched@example.test', now(), '{"provider":"google"}');

insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-000000000310', 'Primary household', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000311', 'Other household', '00000000-0000-0000-0000-000000000306');

insert into public.accounts (id, household_id, name, kind, opening_balance, opening_balance_date)
values ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000310', 'Shared bank', 'bank', 1000, current_date);

insert into public.categories (id, household_id, name, kind)
values ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000310', 'Groceries', 'expense');

insert into public.transactions (id, household_id, kind, amount, occurred_on, account_id, category_id, created_by, paid_by)
values (
  '00000000-0000-0000-0000-000000000314',
  '00000000-0000-0000-0000-000000000310',
  'expense',
  50,
  current_date,
  '00000000-0000-0000-0000-000000000312',
  '00000000-0000-0000-0000-000000000313',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000301'
);

select extensions.throws_like(
  $$
    insert into public.household_allowed_members (household_id, email)
    values ('00000000-0000-0000-0000-000000000310', ' Partner@Example.test ')
  $$,
  '%household_allowed_members_email_check%',
  'authorization requires a normalized email'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000303';
set local request.jwt.claim.email = 'wrong@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","email":"wrong@example.test"}';

select extensions.throws_like(
  $$
    insert into public.household_allowed_members (household_id, email)
    values ('00000000-0000-0000-0000-000000000310', 'partner@example.test')
  $$,
  '%row-level security%',
  'a non-owner cannot authorize a partner'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000301';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","email":"owner@example.test"}';

select extensions.lives_ok(
  $$
    insert into public.household_allowed_members (household_id, email)
    values ('00000000-0000-0000-0000-000000000310', 'partner@example.test')
  $$,
  'the owner can authorize one partner'
);

select extensions.is(
  pg_temp.scalar_or_error($$
    update public.household_allowed_members
    set email = 'replacement@example.test'
    where household_id = '00000000-0000-0000-0000-000000000310'
    returning email
  $$),
  'ERROR 42501: permission denied for table household_allowed_members',
  'pending authorization cannot be overwritten'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000303';
set local request.jwt.claim.email = 'wrong@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","email":"wrong@example.test"}';

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000303', 'member')
  $$,
  '%row-level security%',
  'a wrong-email user cannot join'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000302';
set local request.jwt.claim.email = 'partner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","email":"partner@example.test","app_metadata":{"provider":"email"}}';

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000302', 'member')
  $$,
  '%row-level security%',
  'a non-Google session cannot claim partner membership'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","email":"partner@example.test","app_metadata":{"provider":"google"}}';

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000302', 'owner')
  $$,
  '%row-level security%',
  'an authorized partner cannot join as owner'
);

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000304', 'member')
  $$,
  '%row-level security%',
  'an authorized partner cannot insert another user membership'
);

select extensions.lives_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000302', 'member')
  $$,
  'the matching partner can join only as themself'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
set local request.jwt.claims = '{}';

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000304', 'member')
  $$,
  'A household can have at most two members',
  'the database rejects a third household member'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000301';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","email":"owner@example.test"}';

select extensions.is(
  pg_temp.scalar_or_error($$
    with deleted as (
      delete from public.household_members
      where household_id = '00000000-0000-0000-0000-000000000310'
        and user_id = '00000000-0000-0000-0000-000000000302'
      returning 1
    )
    select count(*)::text from deleted
  $$),
  '0',
  'the owner cannot bypass authorization removal by deleting membership directly'
);

select extensions.is(
  pg_temp.scalar_or_error($$
    update public.household_allowed_members
    set email = 'replacement@example.test'
    where household_id = '00000000-0000-0000-0000-000000000310'
    returning email
  $$),
  'ERROR 42501: permission denied for table household_allowed_members',
  'joined authorization cannot be overwritten'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000303';
set local request.jwt.claim.email = 'wrong@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","email":"wrong@example.test"}';

select extensions.is(
  pg_temp.scalar_or_error($$
    with deleted as (
      delete from public.household_allowed_members
      where household_id = '00000000-0000-0000-0000-000000000310'
      returning 1
    )
    select count(*)::text from deleted
  $$),
  '0',
  'a non-owner cannot remove a joined partner'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000306';
set local request.jwt.claim.email = 'other-owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000306","email":"other-owner@example.test"}';

select extensions.lives_ok(
  $$
    insert into public.household_allowed_members (household_id, email)
    values ('00000000-0000-0000-0000-000000000311', 'cross@example.test')
  $$,
  'the other owner can authorize their partner'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000302';
set local request.jwt.claim.email = 'partner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","email":"partner@example.test"}';

select extensions.is(
  pg_temp.scalar_or_error($$
    select count(*)::text
    from public.household_allowed_members
    where household_id = '00000000-0000-0000-0000-000000000311'
  $$),
  '0',
  'a partner cannot read another household authorization'
);

select extensions.is(
  pg_temp.scalar_or_error($$
    select count(*)::text
    from public.households
    where id = '00000000-0000-0000-0000-000000000311'
  $$),
  '0',
  'a partner cannot read another household'
);

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000302', 'member')
  $$,
  '%row-level security%',
  'a partner cannot join a different household'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000301';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","email":"owner@example.test"}';

select extensions.is(
  pg_temp.scalar_or_error($$
    with deleted as (
      delete from public.household_allowed_members
      where household_id = '00000000-0000-0000-0000-000000000310'
      returning 1
    )
    select count(*)::text from deleted
  $$),
  '1',
  'the owner removes exactly one joined partner'
);

reset role;

select extensions.is((select count(*)::text from auth.users where id = '00000000-0000-0000-0000-000000000302'), '1', 'joined removal preserves the Auth user');
select extensions.is((select count(*)::text from public.profiles where id = '00000000-0000-0000-0000-000000000302'), '1', 'joined removal preserves the profile');
select extensions.is((select count(*)::text from public.household_members where user_id = '00000000-0000-0000-0000-000000000302'), '0', 'joined removal deletes the membership');
select extensions.is((select count(*)::text from public.household_allowed_members where household_id = '00000000-0000-0000-0000-000000000310'), '0', 'joined removal deletes the authorization atomically');
select extensions.is((select count(*)::text from public.transactions where id = '00000000-0000-0000-0000-000000000314'), '1', 'joined removal preserves financial history');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000302';
set local request.jwt.claim.email = 'partner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","email":"partner@example.test","app_metadata":{"provider":"google"}}';

select extensions.throws_like(
  $$
    insert into public.household_members (household_id, user_id, role)
    values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000302', 'member')
  $$,
  '%Partner authorization is required%',
  'a removed partner cannot claim membership after revocation'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000301';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","email":"owner@example.test"}';

select extensions.lives_ok(
  $$
    insert into public.household_allowed_members (household_id, email)
    values ('00000000-0000-0000-0000-000000000310', 'replacement@example.test')
  $$,
  'remove-then-authorize permits a replacement partner'
);

select extensions.is(
  pg_temp.scalar_or_error($$
    with deleted as (
      delete from public.household_allowed_members
      where household_id = '00000000-0000-0000-0000-000000000310'
      returning 1
    )
    select count(*)::text from deleted
  $$),
  '1',
  'the owner can remove a pending authorization'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000303';
set local request.jwt.claim.email = 'wrong@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","email":"wrong@example.test"}';

select extensions.is(
  pg_temp.scalar_or_error($$
    with deleted as (
      delete from public.household_allowed_members
      where household_id = '00000000-0000-0000-0000-000000000311'
      returning 1
    )
    select count(*)::text from deleted
  $$),
  '0',
  'a non-owner cannot remove a pending authorization'
);

select extensions.throws_like(
  $$
    insert into public.households (id, name, created_by)
    values ('00000000-0000-0000-0000-000000000315', 'Self service', '00000000-0000-0000-0000-000000000303')
  $$,
  '%permission denied%',
  'an authenticated user cannot create a household'
);

reset role;

select extensions.ok(not has_table_privilege('anon', 'public.households', 'INSERT'), 'anon has no household creation privilege');
select extensions.ok(not has_table_privilege('authenticated', 'public.households', 'INSERT'), 'authenticated has no household creation privilege');
select extensions.ok(not has_function_privilege('anon', 'public.add_household_owner()', 'EXECUTE'), 'anon cannot execute the owner-provisioning trigger function');
select extensions.ok(not has_function_privilege('authenticated', 'public.add_household_owner()', 'EXECUTE'), 'authenticated cannot execute the owner-provisioning trigger function');
select extensions.ok(not has_function_privilege('anon', 'private.lock_and_validate_partner_claim()', 'EXECUTE'), 'anon cannot execute the partner-claim trigger function');
select extensions.ok(not has_function_privilege('authenticated', 'private.lock_and_validate_partner_claim()', 'EXECUTE'), 'authenticated cannot execute the partner-claim trigger function');
select extensions.ok(not has_function_privilege('anon', 'private.remove_member_after_partner_authorization()', 'EXECUTE'), 'anon cannot execute the partner-removal trigger function');
select extensions.ok(not has_function_privilege('authenticated', 'private.remove_member_after_partner_authorization()', 'EXECUTE'), 'authenticated cannot execute the partner-removal trigger function');

select extensions.lives_ok(
  $$
    insert into public.households (id, name, created_by)
    values ('00000000-0000-0000-0000-000000000316', 'Operator provisioned', '00000000-0000-0000-0000-000000000308')
  $$,
  'an operator can provision a household through direct SQL'
);

select extensions.is(
  (select role::text from public.household_members where household_id = '00000000-0000-0000-0000-000000000316'),
  'owner',
  'operator provisioning creates the owner membership'
);

select * from extensions.finish();
rollback;
