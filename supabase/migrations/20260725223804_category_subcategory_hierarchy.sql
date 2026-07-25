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

drop index public.transactions_category_occurred_on_idx;

create index transactions_subcategory_occurred_on_idx
on public.transactions (subcategory_id, occurred_on desc)
where subcategory_id is not null;
