create function private.is_existing_uncategorized_manual_transaction(
  target_transaction_id uuid,
  target_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_household_member(target_household_id)
    and exists (
      select 1
      from public.transactions as transaction
      where transaction.id = target_transaction_id
        and transaction.household_id = target_household_id
        and transaction.source = 'manual'
        and transaction.category_id is null
        and transaction.subcategory_id is null
    )
$$;

revoke execute on function private.is_existing_uncategorized_manual_transaction(uuid, uuid)
from public, anon;
grant execute on function private.is_existing_uncategorized_manual_transaction(uuid, uuid)
to authenticated;

alter policy "Members can manage transactions"
on public.transactions
with check (
  private.is_household_member(household_id)
  and (
    source = 'statement_import'
    or num_nonnulls(category_id, subcategory_id) = 1
    or private.is_existing_uncategorized_manual_transaction(id, household_id)
  )
);

drop function public.apply_automation_results(uuid, jsonb);

create function public.apply_automation_results(
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

  -- ponytail: table-wide rule locking is enough for rare historic applies; add a
  -- per-household version row only if cross-household rule-write contention appears.
  lock table public.automation_rules in share mode;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rule.id,
        'action', rule.action,
        'pattern', rule.pattern,
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

revoke execute on function public.apply_automation_results(uuid, jsonb, jsonb)
from public, anon;
grant execute on function public.apply_automation_results(uuid, jsonb, jsonb)
to authenticated;
