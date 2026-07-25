create policy "Owners can read joined partner profiles"
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.household_members
    where household_members.user_id = profiles.id
      and household_members.role = 'member'
      and private.is_household_owner(household_members.household_id)
  )
);
