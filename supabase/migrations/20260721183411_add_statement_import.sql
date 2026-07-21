create table public.member_card_mappings (
  household_id uuid not null,
  user_id uuid not null,
  last_four text not null check (last_four ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, user_id)
    references public.household_members (household_id, user_id)
    on delete cascade,
  unique (household_id, last_four)
);

alter table public.member_card_mappings enable row level security;

revoke all on table public.member_card_mappings from public, anon, authenticated;
grant select, insert on table public.member_card_mappings to authenticated;

create policy "Members can read household card mappings"
on public.member_card_mappings for select to authenticated
using (
  exists (
    select 1
    from public.household_members
    where household_members.household_id = member_card_mappings.household_id
      and household_members.user_id = (select auth.uid())
  )
);

create policy "Members can save their own card mappings"
on public.member_card_mappings for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.household_members
    where household_members.household_id = member_card_mappings.household_id
      and household_members.user_id = (select auth.uid())
  )
);
