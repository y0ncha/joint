alter table public.categories
  drop constraint categories_system_key_check,
  add constraint categories_system_key_check check (
    system_key is null
    or (
      archived_at is null
      and (
        (system_key = 'bills' and kind = 'expense' and name = 'Bills')
        or (system_key = 'groceries' and kind = 'expense' and name = 'Groceries')
        or (system_key = 'other_income' and kind = 'income' and name = 'Other')
        or (system_key = 'other_expense' and kind = 'expense' and name = 'Other')
      )
    )
  );

alter table public.transactions
  add column category_id uuid,
  add constraint transactions_household_id_category_id_fkey
    foreign key (household_id, category_id)
    references public.categories (household_id, id),
  add constraint transactions_assignment_exclusive_check
    check (num_nonnulls(category_id, subcategory_id) <= 1),
  add constraint transactions_manual_assignment_check
    check (source = 'statement_import' or num_nonnulls(category_id, subcategory_id) = 1);

alter policy "Members can manage transactions"
on public.transactions
with check (
  private.is_household_member(household_id)
  and (source = 'statement_import' or num_nonnulls(category_id, subcategory_id) = 1)
);

create or replace function private.protect_essential_subcategory()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_system_key text;
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception 'Essential subcategories cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.system_key is not null
    and (new.household_id, new.category_id, new.name, new.archived_at, new.system_key)
      is distinct from (old.household_id, old.category_id, old.name, old.archived_at, old.system_key)
  then
    raise exception 'Essential subcategory identity cannot be changed';
  end if;

  select category.system_key
  into parent_system_key
  from public.categories as category
  where category.id = new.category_id
    and category.household_id = new.household_id;

  if parent_system_key in ('other_income', 'other_expense') then
    raise exception 'Other categories cannot have subcategories';
  end if;

  if parent_system_key = 'groceries'
    and (new.system_key is null or new.system_key not in ('main_run', 'top_ups'))
  then
    raise exception 'Groceries accepts only its protected subcategories';
  end if;

  if new.system_key in ('main_run', 'top_ups') and parent_system_key is distinct from 'groceries' then
    raise exception 'Essential grocery subcategories must belong to Groceries';
  end if;

  return new;
end;
$$;

create or replace function private.seed_essential_categories(target_household_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  groceries_id uuid;
begin
  insert into public.categories (household_id, name, kind, color, icon, system_key)
  values
    (target_household_id, 'Bills', 'expense', '#ccebef', 'receipt', 'bills'),
    (target_household_id, 'Groceries', 'expense', '#f8d7d7', 'shopping-basket', 'groceries'),
    (target_household_id, 'Other', 'income', '#d5d5c4', 'tag', 'other_income'),
    (target_household_id, 'Other', 'expense', '#d5d5c4', 'tag', 'other_expense')
  on conflict (household_id, system_key) where system_key is not null do nothing;

  select id into groceries_id
  from public.categories
  where household_id = target_household_id and system_key = 'groceries';

  insert into public.subcategories (household_id, category_id, name, color, system_key)
  values
    (target_household_id, groceries_id, 'Main run', '#ffe1e8', 'main_run'),
    (target_household_id, groceries_id, 'Top-ups', '#ffedec', 'top_ups')
  on conflict (household_id, system_key) where system_key is not null do nothing;
end;
$$;

do $$
declare target_household_id uuid;
begin
  for target_household_id in select id from public.households loop
    perform private.seed_essential_categories(target_household_id);
  end loop;
end;
$$;

create or replace function private.validate_transaction_subcategory()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_household uuid;
  assignment_archived_at timestamptz;
  category_type public.category_kind;
  category_archived_at timestamptz;
  category_system_key text;
begin
  if new.category_id is not null then
    select household_id, archived_at, kind, system_key
    into assignment_household, assignment_archived_at, category_type, category_system_key
    from public.categories
    where id = new.category_id
    for share;

    if assignment_household is null or assignment_household <> new.household_id then
      raise exception 'Transaction category must belong to its household';
    end if;
    if assignment_archived_at is not null or category_type::text <> new.kind::text then
      raise exception 'Transaction category must be active and match transaction kind';
    end if;
    if category_system_key is distinct from (case new.kind when 'income' then 'other_income' else 'other_expense' end) then
      raise exception 'Only Other categories accept direct transactions';
    end if;
    if new.service_period_start is not null or new.service_period_end is not null then
      raise exception 'Only Bills transactions can have a service period';
    end if;
    return new;
  end if;

  if new.subcategory_id is null then
    if new.service_period_start is not null or new.service_period_end is not null then
      raise exception 'Only Bills transactions can have a service period';
    end if;
    return new;
  end if;

  select subcategory.household_id, subcategory.archived_at, category.kind, category.archived_at, category.system_key
  into assignment_household, assignment_archived_at, category_type, category_archived_at, category_system_key
  from public.subcategories as subcategory
  join public.categories as category on category.id = subcategory.category_id
  where subcategory.id = new.subcategory_id
  for share of subcategory, category;

  if assignment_household is null or assignment_household <> new.household_id then
    raise exception 'Transaction subcategory must belong to its household';
  end if;
  if category_type::text <> new.kind::text then
    raise exception 'Transaction category kind must match transaction kind';
  end if;
  if assignment_archived_at is not null or category_archived_at is not null then
    raise exception 'Transaction category cannot be archived';
  end if;
  if category_system_key = 'bills' then
    if new.service_period_start is null or new.service_period_end is null then
      raise exception 'Bills transactions require a service period';
    end if;
  elsif new.service_period_start is not null or new.service_period_end is not null then
    raise exception 'Only Bills transactions can have a service period';
  end if;
  return new;
end;
$$;
