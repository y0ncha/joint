drop function public.dashboard_balance(date, date, date);
drop function public.dashboard_monthly_review(date);

create function public.dashboard_monthly_review(p_month date)
returns table (
  month date,
  income numeric,
  expenses numeric,
  savings numeric
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
      (date_trunc('month', p_month) - interval '5 months')::date as first_month,
      date_trunc('month', p_month)::date as last_month
    from membership
    where p_month is not null
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
    month,
    income,
    expenses,
    income - expenses as savings
  from monthly_totals
  order by month;
$$;

revoke execute on function public.dashboard_monthly_review(date) from public, anon, authenticated;
grant execute on function public.dashboard_monthly_review(date) to authenticated;
