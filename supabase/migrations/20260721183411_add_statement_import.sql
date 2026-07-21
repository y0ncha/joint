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

create or replace function public.validate_transaction_category()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  category_household uuid;
  category_type public.category_kind;
begin
  if new.source = 'statement_import' and new.category_id is null then
    return new;
  end if;

  select household_id, kind
  into category_household, category_type
  from public.categories
  where id = new.category_id
  for share;

  if category_household is null or category_household <> new.household_id then
    raise exception 'Transaction category must belong to its household';
  end if;

  if category_type::text <> new.kind::text then
    raise exception 'Transaction category kind must match transaction kind';
  end if;

  return new;
end;
$$;

create or replace function public.validate_transaction_paid_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.paid_by is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = new.household_id
      and user_id = new.paid_by
  ) then
    raise exception 'Transaction payer must belong to its household';
  end if;

  return new;
end;
$$;
