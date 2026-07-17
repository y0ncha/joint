drop trigger if exists household_members_enforce_limit
on public.household_members;

drop trigger if exists household_members_clear_partner_authorization
on public.household_members;

drop function if exists private.enforce_household_member_limit();
drop function if exists private.clear_household_partner_authorization();

drop policy "Owners can remove household members"
on public.household_members;

create unique index household_members_one_owner_per_household_idx
on public.household_members (household_id)
where role = 'owner';

create unique index household_members_one_member_per_household_idx
on public.household_members (household_id)
where role = 'member';

drop policy "Authorized users can join a household"
on public.household_members;

create policy "Authorized users can join a household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and (select auth.jwt() -> 'app_metadata' ->> 'provider') = 'google'
  and exists (
    select 1
    from public.household_allowed_members
    where household_allowed_members.household_id = household_members.household_id
      and household_allowed_members.email = (
        select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
  )
);

create function private.lock_and_validate_partner_claim()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  signed_in_user uuid := auth.uid();
begin
  perform 1
  from public.households
  where id = new.household_id
  for update;

  if private.household_member_count(new.household_id) >= 2 then
    raise exception 'A household can have at most two members';
  end if;

  if new.role = 'owner' then
    return new;
  end if;

  -- Operator SQL has no JWT; authenticated claims are also enforced by RLS.
  if signed_in_user is null then
    return new;
  end if;

  if new.user_id <> signed_in_user
    or (auth.jwt() -> 'app_metadata' ->> 'provider') is distinct from 'google' then
    return new;
  end if;

  perform 1
  from public.household_allowed_members
  where household_id = new.household_id;

  if not found then
    raise exception 'Partner authorization is required';
  end if;

  return new;
end;
$$;

revoke execute on function private.lock_and_validate_partner_claim()
from public, anon, authenticated;

create trigger household_members_lock_and_validate_partner_claim
before insert on public.household_members
for each row execute function private.lock_and_validate_partner_claim();

create function private.remove_member_after_partner_authorization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform 1
  from public.households
  where id = old.household_id
  for update;

  delete from public.household_members
  where household_id = old.household_id
    and role = 'member';

  return old;
end;
$$;

revoke execute on function private.remove_member_after_partner_authorization()
from public, anon, authenticated;

create trigger household_allowed_members_remove_member
after delete on public.household_allowed_members
for each row execute function private.remove_member_after_partner_authorization();
