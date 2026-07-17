drop trigger if exists household_members_consume_invitation on public.household_members;
drop function if exists private.consume_matching_invitation();
drop function if exists public.accept_household_invitation(uuid);
drop policy if exists "Invitees can join their invited household" on public.household_members;
drop policy if exists "Owners can manage memberships" on public.household_members;

drop table if exists public.invitations cascade;
drop function if exists public.before_user_created_google_allowlist(jsonb);
drop table if exists private.allowed_google_signin_emails;

create table public.household_allowed_members (
  household_id uuid primary key references public.households(id) on delete cascade,
  email text not null unique check (email = lower(trim(email))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger household_allowed_members_set_updated_at
before update on public.household_allowed_members
for each row execute procedure public.set_updated_at();

alter table public.household_allowed_members enable row level security;

grant select, insert, update, delete on table public.household_allowed_members to authenticated;

create or replace function private.household_member_count(target_household_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, private
as $$
  select count(*)::integer
  from public.household_members
  where household_id = target_household_id;
$$;

revoke execute on function private.household_member_count(uuid) from public, anon, authenticated;

create policy "Owners can read household partner authorization"
on public.household_allowed_members for select to authenticated
using (private.is_household_owner(household_id));

create policy "Users can read matching household partner authorization"
on public.household_allowed_members for select to authenticated
using (email = lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))));

create policy "Owners can create household partner authorization"
on public.household_allowed_members for insert to authenticated
with check (
  private.is_household_owner(household_id)
  and private.household_member_count(household_id) = 1
);

create policy "Owners can update household partner authorization"
on public.household_allowed_members for update to authenticated
using (
  private.is_household_owner(household_id)
  and private.household_member_count(household_id) = 1
)
with check (
  private.is_household_owner(household_id)
  and private.household_member_count(household_id) = 1
);

create policy "Owners can delete household partner authorization"
on public.household_allowed_members for delete to authenticated
using (private.is_household_owner(household_id));

create policy "Owners can remove household members"
on public.household_members for delete to authenticated
using (role = 'member' and private.is_household_owner(household_id));

create policy "Authorized users can join a household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and exists (
    select 1
    from public.household_allowed_members
    where household_allowed_members.household_id = household_members.household_id
      and household_allowed_members.email = lower(trim(coalesce((select auth.jwt() ->> 'email'), '')))
  )
);

create or replace function private.enforce_household_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform 1
  from public.households
  where id = new.household_id
  for update;

  if private.household_member_count(new.household_id) >= 2 then
    raise exception 'A household can have at most two members';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_household_member_limit() from public, anon, authenticated;

create trigger household_members_enforce_limit
before insert on public.household_members
for each row execute function private.enforce_household_member_limit();

create or replace function private.clear_household_partner_authorization()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.role = 'member' then
    delete from public.household_allowed_members
    where household_id = old.household_id;
  end if;

  return old;
end;
$$;

revoke execute on function private.clear_household_partner_authorization() from public, anon, authenticated;

create trigger household_members_clear_partner_authorization
after delete on public.household_members
for each row execute function private.clear_household_partner_authorization();
