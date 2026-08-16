create policy "Members can read household profiles"
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.household_members
    where household_members.user_id = profiles.id
      and private.is_household_member(household_members.household_id)
  )
);
