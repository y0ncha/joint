revoke execute on function public.assign_category_color() from public, anon, authenticated;
revoke execute on function public.assign_household_member_color() from public, anon, authenticated;

alter policy "Users can read their profile"
on public.profiles
using (id = (select auth.uid()));

alter policy "Users can update their profile"
on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create index transactions_household_subcategory_idx
on public.transactions (household_id, subcategory_id)
where subcategory_id is not null;
