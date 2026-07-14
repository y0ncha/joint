begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000010', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000011', 'invitee@example.test'),
  ('00000000-0000-0000-0000-000000000012', 'other@example.test');

insert into public.households (id, name, created_by)
values
  ('00000000-0000-0000-0000-000000000020', 'Active invite household', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000021', 'Expired invite household', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000022', 'Race invite household', '00000000-0000-0000-0000-000000000010');

insert into public.invitations (id, household_id, email, invited_by, expires_at)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000020',
    'invitee@example.test',
    '00000000-0000-0000-0000-000000000010',
    now() + interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000021',
    'invitee@example.test',
    '00000000-0000-0000-0000-000000000010',
    now() - interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000022',
    'invitee@example.test',
    '00000000-0000-0000-0000-000000000010',
    now() + interval '1 day'
  );

create function private.test_consume_race_invitation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.invitations
  set accepted_at = now()
  where household_id = new.household_id
    and accepted_at is null
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end;
$$;

revoke execute on function private.test_consume_race_invitation() from public, anon, authenticated;

create trigger aaa_test_consume_race_invitation
after insert on public.household_members
for each row
when (new.household_id = '00000000-0000-0000-0000-000000000022'::uuid)
execute function private.test_consume_race_invitation();

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
set local request.jwt.claim.email = 'invitee@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","email":"invitee@example.test"}';

set local request.jwt.claim.email = 'wrong-email@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","email":"wrong-email@example.test"}';

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000011',
      'member'
    )
  $$,
  'new row violates row-level security policy for table "household_members"',
  'rejects the signed-in user when the JWT email does not match the invitation'
);

set local request.jwt.claim.email = 'invitee@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","email":"invitee@example.test"}';

select results_eq(
  $$
    select id from public.invitations
    where id = '00000000-0000-0000-0000-000000000030'
  $$,
  array['00000000-0000-0000-0000-000000000030'::uuid],
  'reads the active invitation matching the signed-in email'
);

select lives_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000011',
      'member'
    )
  $$,
  'adds the signed-in invitee to the active invited household'
);

select is(
  (
    select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-000000000020'
      and user_id = '00000000-0000-0000-0000-000000000011'
  ),
  1::bigint,
  'adds the invitee exactly once'
);

reset role;

select ok(
  (
    select accepted_at is not null
    from public.invitations
    where id = '00000000-0000-0000-0000-000000000030'
  ),
  'consumes the active invitation in the insert transaction'
);

set local role authenticated;

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000012',
      'member'
    )
  $$,
  'new row violates row-level security policy for table "household_members"',
  'rejects a different user ID'
);

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000021',
      '00000000-0000-0000-0000-000000000011',
      'member'
    )
  $$,
  'new row violates row-level security policy for table "household_members"',
  'rejects an expired invitation'
);

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000011',
      'member'
    )
  $$,
  'new row violates row-level security policy for table "household_members"',
  'rejects a replayed invitation'
);

select throws_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000022',
      '00000000-0000-0000-0000-000000000011',
      'member'
    )
  $$,
  'Matching invitation could not be consumed',
  'rolls back self-service acceptance when an earlier trigger consumes the invitation'
);

reset role;

select is(
  (
    select count(*) from public.household_members
    where household_id = '00000000-0000-0000-0000-000000000022'
      and user_id = '00000000-0000-0000-0000-000000000011'
  ),
  0::bigint,
  'rolls back the raced membership row'
);

select ok(
  (
    select accepted_at is null
    from public.invitations
    where id = '00000000-0000-0000-0000-000000000032'
  ),
  'rolls back the raced invitation update'
);

drop trigger aaa_test_consume_race_invitation on public.household_members;
drop function private.test_consume_race_invitation();

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000010","email":"owner@example.test"}';

select lives_ok(
  $$
    insert into public.household_members (household_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000012',
      'member'
    )
  $$,
  'allows an owner to add a different member without consuming an invitation'
);

select throws_ok(
  $$ select public.accept_household_invitation('00000000-0000-0000-0000-000000000030'::uuid) $$,
  'function public.accept_household_invitation(uuid) does not exist',
  'removes the public invitation RPC'
);

select * from finish();
rollback;
