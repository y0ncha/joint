create or replace function private.validate_recurring_schedule_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  destination_kind public.category_kind;
  destination_system_key text;
  destination_archived_at timestamptz;
begin
  if not new.enabled then
    if new.category_id is null and new.subcategory_id is null then
      new.paused_reason := coalesce(new.paused_reason, 'Schedule paused because its saved category is no longer available.');
    end if;
    return new;
  end if;

  if new.category_id is null and new.subcategory_id is null then
    new.enabled := false;
    new.paused_reason := coalesce(new.paused_reason, 'Schedule paused because its saved category is no longer available.');
    return new;
  end if;

  if new.paid_by is not null and not exists (
    select 1 from public.household_members
    where household_id = new.household_id and user_id = new.paid_by
  ) then
    raise exception 'Schedule payer must be a household member';
  end if;

  if new.category_id is not null then
    select kind, system_key, archived_at
    into destination_kind, destination_system_key, destination_archived_at
    from public.categories
    where household_id = new.household_id and id = new.category_id;

    if destination_kind is null
      or destination_kind::text is distinct from new.kind::text
      or destination_archived_at is not null
      or destination_system_key is distinct from (case new.kind when 'income' then 'other_income' else 'other_expense' end)
    then
      raise exception 'Schedule category must be an active matching Other category';
    end if;
  else
    select category.kind, greatest(subcategory.archived_at, category.archived_at)
    into destination_kind, destination_archived_at
    from public.subcategories as subcategory
    join public.categories as category on category.id = subcategory.category_id
    where subcategory.household_id = new.household_id and subcategory.id = new.subcategory_id;

    if destination_kind is null or destination_kind::text is distinct from new.kind::text or destination_archived_at is not null then
      raise exception 'Schedule subcategory must be active and match the transaction kind';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.recurring_occurrence_after_from(
  anchor_date date,
  cadence public.recurring_schedule_cadence,
  interval_count integer,
  target_date date,
  starting_index integer
)
returns table(occurrence_index integer, occurs_on date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  due_count integer := 0;
begin
  if anchor_date is null or cadence is null or target_date is null then
    raise exception 'Recurring schedule anchor, cadence, and target date are required.';
  end if;
  if interval_count is null or interval_count not between 1 and 365 then
    raise exception 'Recurring interval_count must be between 1 and 365.';
  end if;
  if starting_index is null or starting_index < 1 then
    raise exception 'Recurring occurrence index must be positive.';
  end if;

  occurrence_index := starting_index;
  loop
    occurs_on := private.recurring_occurrence_date(anchor_date, cadence, interval_count, occurrence_index);
    exit when occurs_on > target_date;
    if due_count >= 366 then
      raise exception 'Recurring schedule catch-up exceeds the maximum of 366 occurrences.';
    end if;
    due_count := due_count + 1;
    occurrence_index := occurrence_index + 1;
  end loop;
  return next;
end;
$$;
