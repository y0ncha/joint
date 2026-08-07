create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  action text not null check (action in ('normalize_merchant', 'assign_category')),
  pattern text not null check (char_length(trim(pattern)) between 1 and 200),
  replacement text check (replacement is null or char_length(trim(replacement)) between 1 and 200),
  category_id uuid,
  subcategory_id uuid,
  enabled boolean not null default true,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, category_id)
    references public.categories(household_id, id) on delete cascade,
  foreign key (household_id, subcategory_id)
    references public.subcategories(household_id, id) on delete cascade,
  check (
    (action = 'normalize_merchant' and replacement is not null and category_id is null and subcategory_id is null)
    or (action = 'assign_category' and replacement is null and num_nonnulls(category_id, subcategory_id) = 1)
  )
);

create index automation_rules_household_position_idx
on public.automation_rules(household_id, position, created_at, id);

create trigger automation_rules_set_updated_at
before update on public.automation_rules
for each row execute procedure public.set_updated_at();

alter table public.automation_rules enable row level security;
revoke all on table public.automation_rules from public, anon, authenticated;
grant select, insert, update, delete on table public.automation_rules to authenticated;

create policy "Members can manage automation rules"
on public.automation_rules for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create function private.validate_automation_rule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_kind public.category_kind;
  target_system_key text;
  target_archived_at timestamptz;
begin
  if new.action = 'normalize_merchant' then
    return new;
  end if;

  if new.category_id is not null then
    select kind, system_key, archived_at
    into target_kind, target_system_key, target_archived_at
    from public.categories
    where household_id = new.household_id and id = new.category_id
    for share;

    if target_archived_at is not null
      or target_system_key is distinct from case target_kind when 'income' then 'other_income' else 'other_expense' end
    then
      raise exception 'Automation category must be an active Other category';
    end if;
    return new;
  end if;

  select category.kind, category.system_key, greatest(subcategory.archived_at, category.archived_at)
  into target_kind, target_system_key, target_archived_at
  from public.subcategories as subcategory
  join public.categories as category on category.id = subcategory.category_id
  where subcategory.household_id = new.household_id and subcategory.id = new.subcategory_id
  for share of subcategory, category;

  if target_kind is null or target_archived_at is not null or target_system_key = 'bills' then
    raise exception 'Automation subcategory must be active and cannot belong to Bills';
  end if;
  return new;
end;
$$;

create trigger automation_rules_validate_destination
before insert or update of household_id, action, category_id, subcategory_id
on public.automation_rules
for each row execute function private.validate_automation_rule();

create function public.reorder_automation_rules(target_household_id uuid, ordered_rule_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;

  select count(*) into expected_count
  from public.automation_rules
  where household_id = target_household_id;

  if cardinality(ordered_rule_ids) <> expected_count
    or (select count(distinct rule_id) from unnest(ordered_rule_ids) as ids(rule_id)) <> expected_count
    or exists (
      select 1
      from unnest(ordered_rule_ids) as ids(rule_id)
      left join public.automation_rules as rule on rule.id = ids.rule_id and rule.household_id = target_household_id
      where rule.id is null
    )
  then
    raise exception 'Rule order must contain every household rule exactly once';
  end if;

  perform 1 from public.automation_rules where household_id = target_household_id for update;
  update public.automation_rules as rule
  set position = ordering.position - 1
  from unnest(ordered_rule_ids) with ordinality as ordering(rule_id, position)
  where rule.id = ordering.rule_id and rule.household_id = target_household_id;
end;
$$;

create function public.apply_automation_results(target_household_id uuid, changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change_count integer;
  updated_count integer;
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;

  with requested as (
    select *
    from jsonb_to_recordset(changes) as change(
      id uuid,
      merchant text,
      category_id uuid,
      subcategory_id uuid,
      expected_updated_at timestamptz,
      expected_merchant text,
      expected_category_id uuid,
      expected_subcategory_id uuid
    )
  )
  select count(*) into change_count from requested;

  if change_count = 0 then return 0; end if;

  if exists (
    with requested as (
      select *
      from jsonb_to_recordset(changes) as change(
        id uuid, merchant text, category_id uuid, subcategory_id uuid, expected_updated_at timestamptz,
        expected_merchant text, expected_category_id uuid, expected_subcategory_id uuid
      )
    )
    select 1
    from requested
    left join public.transactions as transaction on transaction.id = requested.id and transaction.household_id = target_household_id
    where transaction.id is null
      or transaction.updated_at is distinct from requested.expected_updated_at
      or transaction.merchant is distinct from requested.expected_merchant
      or transaction.category_id is distinct from requested.expected_category_id
      or transaction.subcategory_id is distinct from requested.expected_subcategory_id
  ) then
    raise exception 'Automation preview is stale';
  end if;

  perform 1 from public.transactions where household_id = target_household_id and id in (
    select (value ->> 'id')::uuid from jsonb_array_elements(changes)
  ) for update;

  with requested as (
    select *
    from jsonb_to_recordset(changes) as change(
      id uuid, merchant text, category_id uuid, subcategory_id uuid, expected_updated_at timestamptz,
      expected_merchant text, expected_category_id uuid, expected_subcategory_id uuid
    )
  )
  update public.transactions as transaction
  set merchant = requested.merchant,
      category_id = requested.category_id,
      subcategory_id = requested.subcategory_id
  from requested
  where transaction.id = requested.id and transaction.household_id = target_household_id;

  get diagnostics updated_count = row_count;
  if updated_count <> change_count then raise exception 'Automation application was incomplete'; end if;
  return updated_count;
end;
$$;

revoke execute on function public.reorder_automation_rules(uuid, uuid[]) from public, anon;
revoke execute on function public.apply_automation_results(uuid, jsonb) from public, anon;
grant execute on function public.reorder_automation_rules(uuid, uuid[]) to authenticated;
grant execute on function public.apply_automation_results(uuid, jsonb) to authenticated;
