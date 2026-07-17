# Operator owner provisioning

Future household owners must sign in with Google once, then an operator provisions their household through the Supabase SQL editor. The first sign-in creates `auth.users` and `public.profiles`; the application signs the unmatched session out locally. This is the only MVP owner-creation path.

Replace the four operator inputs below and run the complete script as a privileged database operator. `public.on_household_created` creates the owner membership; the script creates the household's internal `Shared balance` bank account. Any failed check or insert aborts the transaction, so no partial household is retained.

```sql
begin;

do $$
declare
  -- Operator inputs
  owner_email constant text := lower(trim('owner@example.com'));
  owner_name constant text := 'Owner name';
  household_name constant text := 'Our home';
  opening_balance constant numeric(12, 2) := 0;

  opening_balance_date constant date := current_date;
  owner_id uuid;
  provisioned_household_id uuid := gen_random_uuid();
  provisioned_rows integer;
begin
  if owner_email = '' or owner_name = '' or household_name = '' then
    raise exception 'Owner email, owner name, and household name are required';
  end if;

  select id
  into strict owner_id
  from auth.users
  where lower(trim(email)) = owner_email;

  if exists (select 1 from public.household_members where user_id = owner_id) then
    raise exception 'The owner already belongs to a household';
  end if;

  update public.profiles
  set full_name = owner_name
  where id = owner_id;

  insert into public.households (id, name, created_by)
  values (provisioned_household_id, household_name, owner_id);

  insert into public.accounts (
    household_id,
    name,
    kind,
    opening_balance,
    opening_balance_date
  ) values (
    provisioned_household_id,
    'Shared balance',
    'bank',
    opening_balance,
    opening_balance_date
  );

  select count(*)
  into provisioned_rows
  from public.household_members
  join public.accounts using (household_id)
  where household_members.household_id = provisioned_household_id
    and household_members.user_id = owner_id
    and household_members.role = 'owner'
    and accounts.name = 'Shared balance'
    and accounts.kind = 'bank';

  if provisioned_rows <> 1 then
    raise exception 'Owner provisioning verification failed';
  end if;

  raise notice 'Provisioned household % for %', provisioned_household_id, owner_email;
end;
$$;

commit;
```

The script verifies the owner membership and shared-balance account before committing, then reports the generated household ID. An exception raised anywhere leaves the transaction aborted; run `rollback;` before retrying with corrected inputs. After a successful commit, ask the owner to sign in again.

The script intentionally requires an existing Auth/profile identity, rejects an owner who already belongs to a household, and uses no service-role application key, public provisioning RPC, Auth Hook, or global access registry.
