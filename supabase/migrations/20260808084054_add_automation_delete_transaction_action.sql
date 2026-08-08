alter table public.automation_rules
  drop constraint automation_rules_check,
  add constraint automation_rules_check check (
    (action = 'normalize_merchant' and replacement is not null and category_id is null and subcategory_id is null)
    or (action = 'assign_category' and replacement is null and num_nonnulls(category_id, subcategory_id) = 1)
    or (action = 'delete_transaction' and replacement is null and category_id is null and subcategory_id is null)
  );

create or replace function private.validate_automation_rule()
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
  if new.action in ('normalize_merchant', 'delete_transaction') then
    return new;
  end if;

  if new.category_id is not null then
    select kind, system_key, archived_at
    into target_kind, target_system_key, target_archived_at
    from public.categories
    where household_id = new.household_id and id = new.category_id
    for share;

    if target_archived_at is not null
      or target_system_key is distinct from (case target_kind when 'income' then 'other_income' else 'other_expense' end)
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

create or replace function public.apply_automation_results(
  target_household_id uuid,
  changes jsonb,
  expected_rule_set jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change_count integer;
  current_rule_set jsonb;
  applied_count integer;
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Not a household member';
  end if;

  with requested as (
    select *
    from jsonb_to_recordset(changes) as change(
      id uuid, merchant text, category_id uuid, subcategory_id uuid, delete_transaction boolean,
      expected_updated_at timestamptz, expected_merchant text, expected_category_id uuid, expected_subcategory_id uuid
    )
  )
  select count(*) into change_count from requested;

  if change_count = 0 then return 0; end if;

  lock table public.automation_rules in share mode;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rule.id, 'action', rule.action, 'pattern', rule.pattern, 'conditions', rule.conditions,
        'replacement', rule.replacement, 'category_id', rule.category_id, 'subcategory_id', rule.subcategory_id,
        'enabled', rule.enabled, 'position', rule.position
      ) order by rule.position, rule.id
    ),
    '[]'::jsonb
  ) into current_rule_set
  from public.automation_rules as rule
  where rule.household_id = target_household_id;

  if jsonb_typeof(expected_rule_set) is distinct from 'array' or current_rule_set is distinct from expected_rule_set then
    raise exception 'Automation preview is stale';
  end if;

  perform 1
  from public.transactions
  where household_id = target_household_id
    and id in (select (value ->> 'id')::uuid from jsonb_array_elements(changes))
  for update;

  if exists (
    with requested as (
      select *
      from jsonb_to_recordset(changes) as change(
        id uuid, merchant text, category_id uuid, subcategory_id uuid, delete_transaction boolean,
        expected_updated_at timestamptz, expected_merchant text, expected_category_id uuid, expected_subcategory_id uuid
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

  with requested as (
    select *
    from jsonb_to_recordset(changes) as change(
      id uuid, merchant text, category_id uuid, subcategory_id uuid, delete_transaction boolean,
      expected_updated_at timestamptz, expected_merchant text, expected_category_id uuid, expected_subcategory_id uuid
    )
  ), deleted as (
    delete from public.transactions as transaction
    using requested
    where transaction.id = requested.id
      and transaction.household_id = target_household_id
      and coalesce(requested.delete_transaction, false)
    returning transaction.id
  ), updated as (
    update public.transactions as transaction
    set merchant = requested.merchant, category_id = requested.category_id, subcategory_id = requested.subcategory_id
    from requested
    where transaction.id = requested.id
      and transaction.household_id = target_household_id
      and not coalesce(requested.delete_transaction, false)
    returning transaction.id
  )
  select count(*) into applied_count
  from (select id from deleted union all select id from updated) as applied;

  if applied_count <> change_count then raise exception 'Automation application was incomplete'; end if;
  return applied_count;
end;
$$;
