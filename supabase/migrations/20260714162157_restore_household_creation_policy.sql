drop policy "Authenticated users can create households" on public.households;

create policy "Authenticated users can create households"
on public.households for insert to authenticated
with check (
  created_by = (select auth.uid())
  and not exists (
    select 1
    from public.household_members
    where user_id = (select auth.uid())
  )
);
