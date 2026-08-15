alter table public.categories
  add column monthly_budget numeric,
  add constraint categories_monthly_budget_check check (
    monthly_budget is null
    or (
      monthly_budget not in (
        'NaN'::numeric,
        'Infinity'::numeric,
        '-Infinity'::numeric
      )
      and monthly_budget > 0
      and scale(monthly_budget) <= 2
      and abs(monthly_budget) < 10000000000
    )
  ),
  add constraint categories_monthly_budget_kind_check check (
    monthly_budget is null or kind = 'expense'
  );

alter table public.subcategories
  add column monthly_budget numeric,
  add constraint subcategories_monthly_budget_check check (
    monthly_budget is null
    or (
      monthly_budget not in (
        'NaN'::numeric,
        'Infinity'::numeric,
        '-Infinity'::numeric
      )
      and monthly_budget > 0
      and scale(monthly_budget) <= 2
      and abs(monthly_budget) < 10000000000
    )
  );

create function private.validate_category_monthly_budget()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind = 'income'::public.category_kind then
    -- Budget validations lock the parent category first. Keep this lock order
    -- before inspecting children so kind changes and child-budget writes serialize.
    perform 1
      from public.categories as category
     where category.id = new.id
       for update;

    if exists (
      select 1
      from public.subcategories as subcategory
      where subcategory.category_id = new.id
        and subcategory.monthly_budget is not null
    ) then
      raise exception 'A category with budgeted children must remain an expense';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_category_monthly_budget()
from public, anon, authenticated;

create trigger categories_validate_monthly_budget
before insert or update of kind, monthly_budget on public.categories
for each row execute function private.validate_category_monthly_budget();

create function private.validate_subcategory_monthly_budget()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_household_id uuid;
  parent_kind public.category_kind;
begin
  if new.monthly_budget is null then
    return new;
  end if;

  select category.household_id, category.kind
    into parent_household_id, parent_kind
    from public.categories as category
   where category.id = new.category_id
     for update;

  if parent_household_id is null
    or parent_household_id is distinct from new.household_id
    or parent_kind is distinct from 'expense'::public.category_kind
  then
    raise exception 'A subcategory budget requires an expense parent in the same household';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_subcategory_monthly_budget()
from public, anon, authenticated;

create trigger subcategories_validate_monthly_budget
before insert or update of household_id, category_id, monthly_budget on public.subcategories
for each row execute function private.validate_subcategory_monthly_budget();

update public.categories as category
   set monthly_budget = household.groceries_monthly_budget
  from public.households as household
 where category.household_id = household.id
   and category.system_key = 'groceries'
   and category.kind = 'expense'
   and household.groceries_monthly_budget is not null;

do $$
begin
  if exists (
    select 1
      from public.households as household
     where household.groceries_monthly_budget is not null
       and not exists (
         select 1
           from public.categories as category
          where category.household_id = household.id
            and category.system_key = 'groceries'
            and category.kind = 'expense'
       )
  ) then
    raise exception 'Cannot migrate a Groceries budget without its protected expense category';
  end if;

  if exists (
    select 1
      from public.households as household
      join public.categories as category
        on category.household_id = household.id
       and category.system_key = 'groceries'
       and category.kind = 'expense'
     where household.groceries_monthly_budget is distinct from category.monthly_budget
  ) then
    raise exception 'Groceries budget migration did not preserve every value';
  end if;
end;
$$;

drop function public.save_current_settings(numeric, text, text, text, text);

alter table public.households
  drop constraint households_groceries_monthly_budget_check,
  drop column groceries_monthly_budget;

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  target_amount numeric not null check (
    target_amount not in (
      'NaN'::numeric,
      'Infinity'::numeric,
      '-Infinity'::numeric
    )
    and target_amount > 0
    and scale(target_amount) <= 2
    and abs(target_amount) < 10000000000
  ),
  saved_amount numeric not null default 0 check (
    saved_amount not in (
      'NaN'::numeric,
      'Infinity'::numeric,
      '-Infinity'::numeric
    )
    and saved_amount >= 0
    and scale(saved_amount) <= 2
    and abs(saved_amount) < 10000000000
  ),
  target_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_goals_household_target_date_idx
  on public.savings_goals (household_id, target_date);

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

revoke all on table public.savings_goals from public, anon;
grant select, insert, update, delete on table public.savings_goals to authenticated;

create policy "Members can manage savings goals"
on public.savings_goals for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));
