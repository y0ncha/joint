begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000040', 'creator@example.test'),
  ('00000000-0000-0000-0000-000000000041', 'other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000040"}';

select lives_ok(
  $$
    insert into public.households (id, name, created_by)
    values (
      '00000000-0000-0000-0000-000000000042',
      'Creator household',
      '00000000-0000-0000-0000-000000000040'
    )
  $$,
  'allows a signed-in user to create their own household'
);

reset role;

select is(
  (
    select role::text
    from public.household_members
    where household_id = '00000000-0000-0000-0000-000000000042'
      and user_id = '00000000-0000-0000-0000-000000000040'
  ),
  'owner',
  'creates the household creator as its owner'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000041';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000041"}';

select throws_ok(
  $$
    insert into public.households (id, name, created_by)
    values (
      '00000000-0000-0000-0000-000000000043',
      'Impersonated household',
      '00000000-0000-0000-0000-000000000040'
    )
  $$,
  'new row violates row-level security policy for table "households"',
  'rejects creating a household for another user'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000040"}';

select throws_ok(
  $$
    insert into public.households (id, name, created_by)
    values (
      '00000000-0000-0000-0000-000000000044',
      'Second household',
      '00000000-0000-0000-0000-000000000040'
    )
  $$,
  'new row violates row-level security policy for table "households"',
  'rejects a user who already belongs to a household'
);

select * from finish();
rollback;
