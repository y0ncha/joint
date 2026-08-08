create or replace function private.validate_automation_rule_conditions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  condition jsonb;
  field text;
  operator text;
  connector text;
  condition_value text;
  condition_count integer;
  condition_index integer;
  group_logic text;
begin
  if new.conditions is null then
    return new;
  end if;

  if jsonb_typeof(new.conditions) is distinct from 'object'
    or jsonb_typeof(new.conditions -> 'conditions') is distinct from 'array'
  then
    raise exception 'Automation conditions must contain an array of conditions';
  end if;

  group_logic := new.conditions ->> 'logic';
  if group_logic is not null and group_logic not in ('and', 'or') then
    raise exception 'Automation condition group logic is invalid';
  end if;

  condition_count := jsonb_array_length(new.conditions -> 'conditions');
  if condition_count < 1 or condition_count > 8 then
    raise exception 'Automation rules must contain between 1 and 8 conditions';
  end if;

  for condition, condition_index in
    select condition_element, condition_ordinality::integer - 1
    from jsonb_array_elements(new.conditions -> 'conditions') with ordinality as condition_rows(condition_element, condition_ordinality)
  loop
    if jsonb_typeof(condition) is distinct from 'object'
      or (condition ? 'field') is false
      or (condition ? 'operator') is false
      or (condition ? 'value') is false
    then
      raise exception 'Automation condition is incomplete';
    end if;

    connector := condition ->> 'connector';
    if condition_index = 0 and (condition ? 'connector') then
      raise exception 'first automation condition cannot have a connector';
    end if;
    if condition_index > 0
      and connector is not null
      and connector not in ('and', 'or')
    then
      raise exception 'Automation condition connector is invalid';
    end if;
    if condition_index > 0 and group_logic is null and connector is null then
      raise exception 'Automation condition connector is required';
    end if;

    field := condition ->> 'field';
    operator := condition ->> 'operator';
    condition_value := condition ->> 'value';

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
      if condition_value !~ '^\d+(\.\d{1,2})?$' then
        raise exception 'Automation amount condition is invalid';
      end if;
      if condition_value::numeric < 0 then
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
      if char_length(trim(condition_value)) < 1
        or char_length(condition_value) > 500
        or (field = 'merchant' and char_length(condition_value) > 200)
      then
        raise exception 'Automation text condition is invalid';
      end if;
    end if;
  end loop;

  return new;
end;
$$;
