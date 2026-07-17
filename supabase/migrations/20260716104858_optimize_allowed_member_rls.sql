drop policy "Owners can read household partner authorization"
on public.household_allowed_members;

drop policy "Users can read matching household partner authorization"
on public.household_allowed_members;

create policy "Owners and matching users can read partner authorization"
on public.household_allowed_members for select to authenticated
using (
  private.is_household_owner(household_id)
  or email = (
    select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);

drop policy "Authorized users can join a household"
on public.household_members;

create policy "Authorized users can join a household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and exists (
    select 1
    from public.household_allowed_members
    where household_allowed_members.household_id = household_members.household_id
      and household_allowed_members.email = (
        select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
  )
);
