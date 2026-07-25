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
