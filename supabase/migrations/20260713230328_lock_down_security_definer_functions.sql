create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;

drop policy "Members can read households" on public.households;
drop policy "Owners can update households" on public.households;
drop policy "Members can read memberships" on public.household_members;
drop policy "Owners can manage memberships" on public.household_members;
drop policy "Owners can manage invitations" on public.invitations;
drop policy "Members can manage accounts" on public.accounts;
drop policy "Members can manage categories" on public.categories;
drop policy "Members can manage transactions" on public.transactions;

create policy "Members can read households" on public.households for select using (private.is_household_member(id));
create policy "Owners can update households" on public.households for update using (private.is_household_owner(id)) with check (private.is_household_owner(id));
create policy "Members can read memberships" on public.household_members for select using (private.is_household_member(household_id));
create policy "Owners can manage memberships" on public.household_members for all using (private.is_household_owner(household_id)) with check (private.is_household_owner(household_id));
create policy "Owners can manage invitations" on public.invitations for all using (private.is_household_owner(household_id)) with check (private.is_household_owner(household_id));
create policy "Members can manage accounts" on public.accounts for all using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
create policy "Members can manage categories" on public.categories for all using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
create policy "Members can manage transactions" on public.transactions for all using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_household_owner() from public, anon, authenticated;
revoke execute on function public.is_household_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_household_owner(uuid) from public, anon, authenticated;
