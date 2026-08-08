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
  condition_value text;
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

  for condition in
    select condition_element
    from jsonb_array_elements(new.conditions -> 'conditions') as condition_rows(condition_element)
  loop
    if jsonb_typeof(condition) is distinct from 'object'
      or (condition ? 'field') is false
      or (condition ? 'operator') is false
      or (condition ? 'value') is false
    then
      raise exception 'Automation condition is incomplete';
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
