create function public.dashboard_monthly_review(p_month date)
returns table (
  month date,
  income numeric,
  expenses numeric,
  savings numeric,
  shared_balance numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with membership as (
    select member.household_id
    from public.household_members as member
    where member.user_id = auth.uid()
      and private.is_household_member(member.household_id)
    limit 1
  ), context as (
    select
      membership.household_id,
      household.opening_balance,
      (date_trunc('month', p_month) - interval '5 months')::date as first_month,
      date_trunc('month', p_month)::date as last_month
    from membership
    join public.households as household on household.id = membership.household_id
    where p_month is not null
  ), baseline as (
    select
      context.household_id,
      context.opening_balance
        + coalesce(sum(case transaction.kind when 'income' then transaction.amount else -transaction.amount end), 0::numeric) as shared_balance
    from context
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.occurred_on < context.first_month
    group by context.household_id, context.opening_balance
  ), monthly_totals as (
    select
      context.household_id,
      month.month::date as month,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'income'), 0::numeric) as income,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'expense'), 0::numeric) as expenses
    from context
    cross join lateral generate_series(context.first_month, context.last_month, interval '1 month') as month(month)
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.occurred_on >= month.month::date
      and transaction.occurred_on < (month.month + interval '1 month')::date
    group by context.household_id, month.month
  )
  select
    totals.month,
    totals.income,
    totals.expenses,
    totals.income - totals.expenses as savings,
    baseline.shared_balance + sum(totals.income - totals.expenses) over (order by totals.month) as shared_balance
  from monthly_totals as totals
  join baseline using (household_id)
  order by totals.month;
$$;

create function public.dashboard_category_changes(p_month date)
returns table (
  category_name text,
  kind public.category_kind,
  amount numeric,
  average_amount numeric,
  change_amount numeric,
  change_percentage numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with membership as (
    select member.household_id
    from public.household_members as member
    where member.user_id = auth.uid()
      and private.is_household_member(member.household_id)
    limit 1
  ), context as (
    select
      membership.household_id,
      date_trunc('month', p_month)::date as current_month
    from membership
    where p_month is not null
  ), category_months as (
    select
      category.id as category_id,
      category.name as category_name,
      category.kind,
      month.month::date as month,
      coalesce(sum(transaction.amount), 0::numeric) as amount
    from context
    cross join lateral generate_series(context.current_month - interval '3 months', context.current_month, interval '1 month') as month(month)
    join public.categories as category on category.household_id = context.household_id
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.kind::text = category.kind::text
      and transaction.occurred_on >= month.month::date
      and transaction.occurred_on < (month.month + interval '1 month')::date
    left join public.subcategories as subcategory
      on subcategory.id = transaction.subcategory_id
      and subcategory.household_id = context.household_id
    where transaction.category_id = category.id or subcategory.category_id = category.id or transaction.id is null
    group by category.id, category.name, category.kind, month.month
  ), changes as (
    select
      category_name,
      kind,
      max(amount) filter (where month = (select current_month from context)) as amount,
      avg(amount) filter (where month < (select current_month from context)) as average_amount
    from category_months
    group by category_name, kind
  )
  select
    category_name,
    kind,
    amount,
    average_amount,
    amount - average_amount as change_amount,
    case when average_amount = 0 then null else (amount - average_amount) / average_amount * 100 end as change_percentage
  from changes
  where abs(amount - average_amount) >= 250
    and (average_amount = 0 or abs((amount - average_amount) / average_amount) >= .2)
  order by abs(amount - average_amount) desc, category_name
  limit 3;
$$;

revoke execute on function public.dashboard_monthly_review(date) from public, anon, authenticated;
revoke execute on function public.dashboard_category_changes(date) from public, anon, authenticated;
grant execute on function public.dashboard_monthly_review(date) to authenticated;
grant execute on function public.dashboard_category_changes(date) to authenticated;
