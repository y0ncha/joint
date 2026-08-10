create function public.dashboard_summary(p_month date, p_range_from date, p_range_to date)
returns table (
  income numeric,
  expenses numeric,
  income_change_percentage numeric,
  expense_change_percentage numeric
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
    select avg(income) as income, avg(expenses) as expenses
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
    end
  from selected_totals as selected
  left join comparison_averages as comparison on true;
$$;

create function public.dashboard_spending(p_month date, p_range_from date, p_range_to date)
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
  )
  select
    category.id,
    category.name,
    sum(transaction.amount) as amount
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
  group by category.id, category.name
  order by amount desc, category.name;
$$;

create function public.dashboard_balance(p_month date, p_range_from date, p_range_to date)
returns table (
  shared_balance numeric,
  expected_monthly_income numeric,
  expenses numeric
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
      date_trunc('month', p_month)::date as month_start,
      coalesce(p_range_from, date_trunc('month', p_month)::date) as period_from,
      case
        when p_range_from is not null then p_range_to
        when date_trunc('month', p_month)::date = date_trunc('month', current_date)::date then current_date
        else (date_trunc('month', p_month) + interval '1 month - 1 day')::date
      end as period_to,
      coalesce(p_range_to, (date_trunc('month', p_month) + interval '1 month - 1 day')::date) as balance_to,
      p_range_from is not null as custom_range
    from membership
    join public.households as household on household.id = membership.household_id
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
  ), balance_totals as (
    select
      context.household_id,
      context.opening_balance
        + coalesce(sum(
            case transaction.kind
              when 'income' then transaction.amount
              else -transaction.amount
            end
          ), 0::numeric) as shared_balance
    from context
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.occurred_on <= context.balance_to
    group by context.household_id, context.opening_balance
  ), selected_expenses as (
    select
      context.household_id,
      coalesce(sum(transaction.amount), 0::numeric) as expenses
    from context
    left join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.kind = 'expense'
      and transaction.occurred_on between context.period_from and context.period_to
    group by context.household_id
  ), monthly_income_samples as (
    select
      context.household_id,
      sum(transaction.amount) as income
    from context
    cross join generate_series(1, 3) as comparison(number)
    cross join lateral (
      select (context.month_start - make_interval(months => comparison.number))::date as period_from
    ) as previous_period
    join public.transactions as transaction
      on transaction.household_id = context.household_id
      and transaction.kind = 'income'
      and transaction.occurred_on >= previous_period.period_from
      and transaction.occurred_on < previous_period.period_from + interval '1 month'
    where not context.custom_range
    group by context.household_id, previous_period.period_from
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
  ), custom_income_samples as (
    select
      period.household_id,
      coalesce(sum(transaction.amount), 0::numeric) as income
    from custom_comparison_periods as period
    left join public.transactions as transaction
      on transaction.household_id = period.household_id
      and transaction.kind = 'income'
      and transaction.occurred_on between period.period_from and period.period_to
    group by period.household_id, period.period_from
  ), income_samples as (
    select * from monthly_income_samples
    union all
    select * from custom_income_samples
  ), expected_income as (
    select household_id, avg(income) as income
    from income_samples
    group by household_id
  )
  select
    balance.shared_balance,
    expected.income,
    selected.expenses
  from balance_totals as balance
  join selected_expenses as selected using (household_id)
  left join expected_income as expected using (household_id);
$$;

create function public.dashboard_recent_activity(p_month date, p_range_from date, p_range_to date)
returns table (
  id uuid,
  kind public.transaction_kind,
  amount numeric,
  occurred_on date,
  merchant text,
  note text,
  source public.transaction_source,
  category_name text,
  subcategory_name text
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
      coalesce(p_range_to, (date_trunc('month', p_month) + interval '1 month - 1 day')::date) as period_to
    from membership
    where p_month is not null
      and (
        (p_range_from is null and p_range_to is null)
        or (p_range_from is not null and p_range_to is not null and p_range_from <= p_range_to)
      )
  )
  select
    transaction.id,
    transaction.kind,
    transaction.amount,
    transaction.occurred_on,
    transaction.merchant,
    transaction.note,
    transaction.source,
    category.name,
    subcategory.name
  from context
  join public.transactions as transaction
    on transaction.household_id = context.household_id
    and transaction.occurred_on between context.period_from and context.period_to
  left join public.subcategories as subcategory
    on subcategory.id = transaction.subcategory_id
    and subcategory.household_id = transaction.household_id
  left join public.categories as category
    on category.id = coalesce(transaction.category_id, subcategory.category_id)
    and category.household_id = transaction.household_id
  order by transaction.occurred_on desc, transaction.created_at desc, transaction.id desc
  limit 5;
$$;

revoke execute on function public.dashboard_summary(date, date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_spending(date, date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_balance(date, date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_recent_activity(date, date, date) from public, anon, authenticated;

grant execute on function public.dashboard_summary(date, date, date) to authenticated;
grant execute on function public.dashboard_spending(date, date, date) to authenticated;
grant execute on function public.dashboard_balance(date, date, date) to authenticated;
grant execute on function public.dashboard_recent_activity(date, date, date) to authenticated;
