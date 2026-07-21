grant update on table public.member_card_mappings to authenticated;

create policy "Members can update their own card mappings"
on public.member_card_mappings for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.household_members
    where household_members.household_id = member_card_mappings.household_id
      and household_members.user_id = (select auth.uid())
  )
);
