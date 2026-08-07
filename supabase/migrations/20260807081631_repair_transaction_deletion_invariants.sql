alter table public.transactions
  drop constraint transactions_manual_assignment_check;

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
    new.service_period_start := null;
    new.service_period_end := null;
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
