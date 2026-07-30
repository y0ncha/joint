truncate table public.transactions, public.categories cascade;

alter table public.categories
  add column system_key text,
  add constraint categories_system_key_check check (
    system_key is null
    or (
      kind = 'expense'
      and archived_at is null
      and (
        (system_key = 'bills' and name = 'Bills')
        or (system_key = 'groceries' and name = 'Groceries')
      )
    )
  );

create unique index categories_household_system_key_key
on public.categories (household_id, system_key)
where system_key is not null;

alter table public.subcategories
  add column system_key text,
  add constraint subcategories_system_key_check check (
    system_key is null
    or (
      archived_at is null
      and (
        (system_key = 'main_run' and name = 'Main run')
        or (system_key = 'top_ups' and name = 'Top-ups')
      )
    )
  );

create unique index subcategories_household_system_key_key
on public.subcategories (household_id, system_key)
where system_key is not null;

create function private.protect_essential_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception 'Essential categories cannot be deleted';
    end if;
    return old;
  end if;

  if old.system_key is not null
    and (
      new.household_id,
      new.name,
      new.kind,
      new.archived_at,
      new.system_key
    ) is distinct from (
      old.household_id,
      old.name,
      old.kind,
      old.archived_at,
      old.system_key
    )
  then
    raise exception 'Essential category identity cannot be changed';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_essential_category()
from public, anon, authenticated;

create trigger categories_protect_essential_identity
before update or delete on public.categories
for each row execute function private.protect_essential_category();

create function private.protect_essential_subcategory()
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
    and (
      new.household_id,
      new.category_id,
      new.name,
      new.archived_at,
      new.system_key
    ) is distinct from (
      old.household_id,
      old.category_id,
      old.name,
      old.archived_at,
      old.system_key
    )
  then
    raise exception 'Essential subcategory identity cannot be changed';
  end if;

  select category.system_key
  into parent_system_key
  from public.categories as category
  where category.id = new.category_id
    and category.household_id = new.household_id;

  if parent_system_key = 'groceries'
    and (new.system_key is null or new.system_key not in ('main_run', 'top_ups'))
  then
    raise exception 'Groceries accepts only its protected subcategories';
  end if;

  if new.system_key in ('main_run', 'top_ups')
    and parent_system_key is distinct from 'groceries'
  then
    raise exception 'Essential grocery subcategories must belong to Groceries';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_essential_subcategory()
from public, anon, authenticated;

create trigger subcategories_protect_essential_identity
before insert or update or delete on public.subcategories
for each row execute function private.protect_essential_subcategory();

create function private.seed_essential_categories(target_household_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  groceries_id uuid;
begin
  insert into public.categories (
    household_id,
    name,
    kind,
    color,
    icon,
    system_key
  )
  values (
    target_household_id,
    'Bills',
    'expense',
    '#ccebef',
    'receipt',
    'bills'
  );

  insert into public.categories (
    household_id,
    name,
    kind,
    color,
    icon,
    system_key
  )
  values (
    target_household_id,
    'Groceries',
    'expense',
    '#f8d7d7',
    'shopping-basket',
    'groceries'
  )
  returning id into groceries_id;

  insert into public.subcategories (
    household_id,
    category_id,
    name,
    color,
    system_key
  )
  values
    (
      target_household_id,
      groceries_id,
      'Main run',
      '#ffe1e8',
      'main_run'
    ),
    (
      target_household_id,
      groceries_id,
      'Top-ups',
      '#ffedec',
      'top_ups'
    );
end;
$$;

revoke execute on function private.seed_essential_categories(uuid)
from public, anon, authenticated;

do $$
declare
  target_household_id uuid;
begin
  for target_household_id in
    select household.id
    from public.households as household
    order by household.id
  loop
    perform private.seed_essential_categories(target_household_id);
  end loop;
end;
$$;

create or replace function public.add_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  perform private.seed_essential_categories(new.id);

  return new;
end;
$$;
