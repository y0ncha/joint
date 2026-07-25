truncate public.transactions, public.categories cascade;

alter table public.categories
  add constraint categories_household_id_id_key unique (household_id, id);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, name),
  foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete cascade
);

alter table public.subcategories
  add constraint subcategories_household_id_id_key unique (household_id, id);

create trigger subcategories_set_updated_at
before update on public.subcategories
for each row execute procedure public.set_updated_at();

alter table public.subcategories enable row level security;

revoke all on table public.subcategories from anon, authenticated;
grant select, insert, update, delete on table public.subcategories to authenticated;

create policy "Members can manage subcategories"
on public.subcategories for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop trigger transactions_validate_category on public.transactions;
drop function public.validate_transaction_category();
drop trigger categories_validate_transaction_links on public.categories;
drop function public.validate_category_transaction_links();

alter table public.transactions
  drop constraint transactions_category_id_fkey,
  drop constraint transactions_category_required_check,
  drop column category_id,
  add column subcategory_id uuid,
  add constraint transactions_household_id_subcategory_id_fkey
    foreign key (household_id, subcategory_id)
    references public.subcategories (household_id, id),
  add constraint transactions_subcategory_required_check
    check (
      (source = 'manual' and subcategory_id is not null)
      or source = 'statement_import'
    );

create function public.validate_transaction_subcategory()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  subcategory_household uuid;
  subcategory_archived_at timestamptz;
  category_type public.category_kind;
  category_archived_at timestamptz;
begin
  if new.subcategory_id is null then
    return new;
  end if;

  select subcategory.household_id,
         subcategory.archived_at,
         category.kind,
         category.archived_at
  into subcategory_household,
       subcategory_archived_at,
       category_type,
       category_archived_at
  from public.subcategories as subcategory
  join public.categories as category
    on category.id = subcategory.category_id
  where subcategory.id = new.subcategory_id
  for share of subcategory, category;

  if subcategory_household is null or subcategory_household <> new.household_id then
    raise exception 'Transaction subcategory must belong to its household';
  end if;

  if category_type::text <> new.kind::text then
    raise exception 'Transaction category kind must match transaction kind';
  end if;

  if subcategory_archived_at is not null then
    raise exception 'Transaction subcategory cannot be archived';
  end if;

  if category_archived_at is not null then
    raise exception 'Transaction category cannot be archived';
  end if;

  return new;
end;
$$;

create trigger transactions_validate_subcategory
before insert or update on public.transactions
for each row execute function public.validate_transaction_subcategory();

create function public.validate_category_transaction_links()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if (new.household_id, new.kind) is distinct from (old.household_id, old.kind)
    and exists (
      select 1
      from public.subcategories as subcategory
      join public.transactions as txn
        on txn.subcategory_id = subcategory.id
      where subcategory.category_id = old.id
    ) then
    raise exception 'A referenced transaction category cannot change household or kind';
  end if;

  return new;
end;
$$;

create trigger categories_validate_transaction_links
before update of household_id, kind on public.categories
for each row execute function public.validate_category_transaction_links();

create function public.validate_subcategory_transaction_links()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if (new.household_id, new.category_id) is distinct from (old.household_id, old.category_id)
    and exists (
      select 1
      from public.transactions
      where subcategory_id = old.id
    ) then
    raise exception 'A referenced transaction subcategory cannot change household or category';
  end if;

  return new;
end;
$$;

create trigger subcategories_validate_transaction_links
before update of household_id, category_id on public.subcategories
for each row execute function public.validate_subcategory_transaction_links();

drop index public.transactions_category_occurred_on_idx;

create index transactions_subcategory_occurred_on_idx
on public.transactions (subcategory_id, occurred_on desc)
where subcategory_id is not null;

create function private.next_category_pastel(target_household_id uuid)
returns text
language sql
volatile
set search_path = ''
as $$
  with palette(color, position) as (
    values
      ('#f1f5f9'::text, 1), ('#e2e8f0', 2), ('#f3f4f6', 3), ('#e5e7eb', 4),
      ('#f4f4f5', 5), ('#e4e4e7', 6), ('#f5f5f5', 7), ('#e5e5e5', 8),
      ('#f5f5f4', 9), ('#e7e5e4', 10), ('#fee2e2', 11), ('#fecaca', 12),
      ('#ffedd5', 13), ('#fed7aa', 14), ('#fef3c7', 15), ('#fde68a', 16),
      ('#fef9c3', 17), ('#fef08a', 18), ('#ecfccb', 19), ('#d9f99d', 20),
      ('#dcfce7', 21), ('#bbf7d0', 22), ('#d1fae5', 23), ('#a7f3d0', 24),
      ('#ccfbf1', 25), ('#99f6e4', 26), ('#cffafe', 27), ('#a5f3fc', 28),
      ('#e0f2fe', 29), ('#bae6fd', 30), ('#dbeafe', 31), ('#bfdbfe', 32),
      ('#e0e7ff', 33), ('#c7d2fe', 34), ('#ede9fe', 35), ('#ddd6fe', 36),
      ('#f3e8ff', 37), ('#e9d5ff', 38), ('#fae8ff', 39), ('#f5d0fe', 40),
      ('#fce7f3', 41), ('#fbcfe8', 42), ('#ffe4e6', 43), ('#fecdd3', 44),
      ('#dcece3', 45), ('#ece5f4', 46)
  ), unused as (
    select palette.color
    from palette
    where not exists (
      select 1
      from public.categories as category
      where category.household_id = target_household_id
        and lower(category.color) = palette.color
    )
  ), candidates as (
    select color from unused
    union all
    select color from palette
    where not exists (select 1 from unused)
  )
  select color from candidates order by random() limit 1;
$$;

revoke execute on function private.next_category_pastel(uuid) from public, anon, authenticated;

create or replace function public.assign_category_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.households where id = new.household_id for update;

  if new.color is null then
    new.color := private.next_category_pastel(new.household_id);
  end if;
  return new;
end;
$$;
