drop function if exists public.dashboard_summary(date, date, date);

create function public.dashboard_summary(p_month date, p_range_from date, p_range_to date)
returns table (
  income numeric,
  expenses numeric,
  income_change_percentage numeric,
  expense_change_percentage numeric,
  balance_change_percentage numeric
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
      date_trunc('month', p_month)::date as month_start,
      coalesce(p_range_from, date_trunc('month', p_month)::date) as period_from,
      case
        when p_range_from is not null then p_range_to
        when date_trunc('month', p_month)::date = date_trunc('month', current_date)::date then current_date
        else (date_trunc('month', p_month) + interval '1 month - 1 day')::date
      end as period_to,
      p_range_from is not null as custom_range
    from membership
    where p_month is not null
      and (
        (p_range_from is null and p_range_to is null)
        or (p_range_from is not null and p_range_to is not null and p_range_from <= p_range_to)
      )
  ), first_transaction as (
    select min(transaction.occurred_on) as occurred_on
    from context
    join public.transactions as transaction
      on transaction.household_id = context.household_id
  ), selected_totals as (
    select
      context.household_id,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'income'), 0::numeric) as income,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'expense'), 0::numeric) as expenses
    from context
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.occurred_on between context.period_from and context.period_to
    group by context.household_id
  ), custom_comparison_periods as (
    select
      context.household_id,
      context.period_from - comparison.number * (context.period_to - context.period_from + 1) as period_from,
      context.period_from - 1 - (comparison.number - 1) * (context.period_to - context.period_from + 1) as period_to
    from context
    cross join generate_series(1, 3) as comparison(number)
    cross join first_transaction
    where context.custom_range
      and context.period_from - comparison.number * (context.period_to - context.period_from + 1) >= first_transaction.occurred_on
  ), monthly_comparison_periods as (
    select
      context.household_id,
      previous_period.period_from,
      least(
        previous_period.period_from + (current_date - context.month_start),
        (previous_period.period_from + interval '1 month - 1 day')::date
      ) as period_to
    from context
    cross join generate_series(1, 3) as comparison(number)
    cross join lateral (
      select (context.month_start - make_interval(months => comparison.number))::date as period_from
    ) as previous_period
    where not context.custom_range
      and context.month_start = date_trunc('month', current_date)::date
  ), comparison_periods as (
    select * from custom_comparison_periods
    union all
    select * from monthly_comparison_periods
  ), comparison_totals as (
    select
      period.household_id,
      period.period_from,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'income'), 0::numeric) as income,
      coalesce(sum(transaction.amount) filter (where transaction.kind = 'expense'), 0::numeric) as expenses
    from comparison_periods as period
    left join public.transactions as transaction
      on transaction.household_id = period.household_id
      and transaction.occurred_on between period.period_from and period.period_to
    group by period.household_id, period.period_from
  ), comparison_averages as (
    select
      avg(income) as income,
      avg(expenses) as expenses,
      avg(income - expenses) as balance
    from comparison_totals
  )
  select
    selected.income,
    selected.expenses,
    case
      when comparison.income is null or comparison.income = 0 then null
      else ((selected.income - comparison.income) / comparison.income) * 100
    end,
    case
      when comparison.expenses is null or comparison.expenses = 0 then null
      else ((selected.expenses - comparison.expenses) / comparison.expenses) * 100
    end,
    case
      when comparison.balance is null or comparison.balance = 0 then null
      else (((selected.income - selected.expenses) - comparison.balance) / comparison.balance) * 100
    end
  from selected_totals as selected
  left join comparison_averages as comparison on true;
$$;

drop function if exists public.dashboard_spending(date, date, date, uuid);
drop function if exists public.dashboard_spending(date, date, date);

create function public.dashboard_spending_breakdown(
  p_month date,
  p_range_from date,
  p_range_to date,
  p_category_ids uuid[],
  p_subcategories boolean
)
returns table (
  category_id uuid,
  category_name text,
  amount numeric
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
      coalesce(p_range_from, date_trunc('month', p_month)::date) as period_from,
      case
        when p_range_from is not null then p_range_to
        when date_trunc('month', p_month)::date = date_trunc('month', current_date)::date then current_date
        else (date_trunc('month', p_month) + interval '1 month - 1 day')::date
      end as period_to
    from membership
    where p_month is not null
      and (
        (p_range_from is null and p_range_to is null)
        or (p_range_from is not null and p_range_to is not null and p_range_from <= p_range_to)
      )
  ), all_categories as (
    select category.id, category.household_id, category.archived_at
    from context
    join public.categories as category on category.household_id = context.household_id
    where category.kind = 'expense'
  ), eligible_categories as (
    select category.id, category.household_id
    from all_categories as category
    where category.archived_at is null
      and exists (
      select 1
      from public.subcategories as subcategory
      where subcategory.category_id = category.id
        and subcategory.household_id = category.household_id
        and subcategory.archived_at is null
    )
  ), requested_categories as (
    select distinct category.id
    from eligible_categories as category
    join unnest(coalesce(p_category_ids, '{}'::uuid[])) as requested(id) on requested.id = category.id
  ), selected_categories as (
    select id
    from requested_categories
    union all
    select category.id
    from all_categories as category
    where not exists (select 1 from requested_categories)
  ), period_transactions as (
    select
      transaction.amount,
      category.id as parent_id,
      category.name as parent_name,
      subcategory.id as subcategory_id,
      subcategory.name as subcategory_name
    from context
    join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.kind = 'expense'
      and transaction.occurred_on between context.period_from and context.period_to
    left join public.subcategories as subcategory
      on subcategory.id = transaction.subcategory_id
      and subcategory.household_id = transaction.household_id
    join public.categories as category
      on category.id = coalesce(transaction.category_id, subcategory.category_id)
      and category.household_id = transaction.household_id
      and category.kind = 'expense'
  )
  select
    transaction.parent_id,
    transaction.parent_name,
    sum(transaction.amount) as amount
  from period_transactions as transaction
  join selected_categories as selected on selected.id = transaction.parent_id
  where not coalesce(p_subcategories, false)
  group by transaction.parent_id, transaction.parent_name

  union all

  select
    transaction.subcategory_id,
    transaction.subcategory_name,
    sum(transaction.amount) as amount
  from period_transactions as transaction
  join selected_categories as selected on selected.id = transaction.parent_id
  where coalesce(p_subcategories, false)
    and transaction.subcategory_id is not null
  group by transaction.subcategory_id, transaction.subcategory_name
  order by 3 desc, 2;
$$;

drop function if exists public.dashboard_recent_activity(date, date, date);
drop function if exists public.dashboard_category_changes(date);

revoke execute on function public.dashboard_summary(date, date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_spending_breakdown(date, date, date, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.dashboard_summary(date, date, date) to authenticated;
grant execute on function public.dashboard_spending_breakdown(date, date, date, uuid[], boolean) to authenticated;
