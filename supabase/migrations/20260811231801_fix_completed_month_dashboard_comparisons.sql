create or replace function public.dashboard_summary(
  p_month date,
  p_range_from date default null,
  p_range_to date default null
)
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
      case
        when context.month_start = date_trunc('month', current_date)::date then least(
          previous_period.period_from + (current_date - context.month_start),
          (previous_period.period_from + interval '1 month - 1 day')::date
        )
        else (previous_period.period_from + interval '1 month - 1 day')::date
      end as period_to
    from context
    cross join generate_series(1, 3) as comparison(number)
    cross join lateral (
      select (context.month_start - make_interval(months => comparison.number))::date as period_from
    ) as previous_period
    where not context.custom_range
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
