alter table public.automation_rules
  add column conditions jsonb;

create function private.validate_automation_rule_conditions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  condition jsonb;
  field text;
  operator text;
  value text;
  condition_count integer;
begin
  if new.conditions is null then
    return new;
  end if;

  if jsonb_typeof(new.conditions) is distinct from 'object'
    or (new.conditions ? 'logic') is false
    or new.conditions ->> 'logic' not in ('and', 'or')
    or jsonb_typeof(new.conditions -> 'conditions') is distinct from 'array'
  then
    raise exception 'Automation conditions must be an and/or group';
  end if;

  condition_count := jsonb_array_length(new.conditions -> 'conditions');
  if condition_count < 1 or condition_count > 8 then
    raise exception 'Automation rules must contain between 1 and 8 conditions';
  end if;

  for condition in select value from jsonb_array_elements(new.conditions -> 'conditions') loop
    if jsonb_typeof(condition) is distinct from 'object'
      or (condition ? 'field') is false
      or (condition ? 'operator') is false
      or (condition ? 'value') is false
    then
      raise exception 'Automation condition is incomplete';
    end if;

    field := condition ->> 'field';
    operator := condition ->> 'operator';
    value := condition ->> 'value';

    if field not in ('merchant', 'note', 'amount') then
      raise exception 'Automation condition field is invalid';
    end if;

    if field = 'amount' then
      if operator not in ('equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal')
        or (jsonb_typeof(condition -> 'value') is distinct from 'number'
          and jsonb_typeof(condition -> 'value') is distinct from 'string')
      then
        raise exception 'Automation amount condition is invalid';
      end if;
      if value !~ '^\d+(\.\d{1,2})?$' then
        raise exception 'Automation amount condition is invalid';
      end if;
      if value::numeric < 0 then
        raise exception 'Automation amount condition is invalid';
      end if;
    else
      if (
        operator not in ('contains', 'equals', 'starts_with', 'ends_with')
        and not (field = 'merchant' and operator = 'advanced')
      )
        or jsonb_typeof(condition -> 'value') is distinct from 'string'
      then
        raise exception 'Automation text condition is invalid';
      end if;
      if char_length(trim(value)) < 1
        or char_length(value) > 500
        or (field = 'merchant' and char_length(value) > 200)
      then
        raise exception 'Automation text condition is invalid';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger automation_rules_validate_conditions
before insert or update of conditions on public.automation_rules
for each row execute function private.validate_automation_rule_conditions();

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

  lock table public.automation_rules in share mode;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rule.id,
        'action', rule.action,
        'pattern', rule.pattern,
        'conditions', rule.conditions,
        'replacement', rule.replacement,
        'category_id', rule.category_id,
        'subcategory_id', rule.subcategory_id,
        'enabled', rule.enabled,
        'position', rule.position
      )
      order by rule.position, rule.id
    ),
    '[]'::jsonb
  )
  into current_rule_set
  from public.automation_rules as rule
  where rule.household_id = target_household_id;

  if jsonb_typeof(expected_rule_set) is distinct from 'array'
    or current_rule_set is distinct from expected_rule_set
  then
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
