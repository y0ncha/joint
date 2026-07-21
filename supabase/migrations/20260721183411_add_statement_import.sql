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

create type public.transaction_source as enum ('manual', 'statement_import');

alter table public.transactions
  alter column paid_by drop not null,
  add column source public.transaction_source not null default 'manual',
  add column merchant text not null default '' check (char_length(merchant) <= 200),
  add column import_file_hash text,
  add column import_row_number integer,
  drop constraint transactions_category_required_check,
  add constraint transactions_category_required_check
    check (
      (source = 'manual' and category_id is not null)
      or source = 'statement_import'
    ),
  add constraint transactions_import_metadata_check
    check (
      (source = 'statement_import'
        and import_file_hash is not null
        and import_file_hash ~ '^[0-9a-f]{64}$'
        and import_row_number is not null
        and import_row_number > 0)
      or (source = 'manual'
        and import_file_hash is null
        and import_row_number is null)
    );

create unique index transactions_import_file_row_unique_idx
on public.transactions (household_id, import_file_hash, import_row_number)
where source = 'statement_import';
