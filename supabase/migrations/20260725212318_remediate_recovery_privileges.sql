drop extension if exists index_advisor;
drop extension if exists hypopg;

alter policy "Members can manage categories" on public.categories to authenticated;
alter policy "Members can read memberships" on public.household_members to authenticated;
alter policy "Members can read households" on public.households to authenticated;
alter policy "Owners can update households" on public.households to authenticated;
alter policy "Users can read their profile" on public.profiles to authenticated;
alter policy "Users can update their profile" on public.profiles to authenticated;
alter policy "Members can manage transactions" on public.transactions to authenticated;

revoke all on table public.categories, public.household_allowed_members, public.household_members, public.households, public.member_cards, public.profiles, public.transactions from anon;

revoke all on table public.categories, public.household_allowed_members, public.household_members, public.households, public.member_cards, public.profiles, public.transactions from authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, delete on table public.household_allowed_members to authenticated;
grant select, insert on table public.household_members to authenticated;
grant select, update on table public.households to authenticated;
grant select, insert, update on table public.member_cards to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
