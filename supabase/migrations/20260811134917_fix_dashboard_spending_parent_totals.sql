create or replace function public.dashboard_spending(p_month date, p_range_from date, p_range_to date, p_category_id uuid)
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
  ), selected_category as (
    select category.id
    from context
    join public.categories as category on category.household_id = context.household_id
    where category.id = p_category_id
      and category.kind = 'expense'
      and category.archived_at is null
      and exists (
        select 1
        from public.subcategories as subcategory
        where subcategory.category_id = category.id
          and subcategory.household_id = category.household_id
          and subcategory.archived_at is null
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
  where not exists (select 1 from selected_category)
  group by category.id, category.name

  union all

  select
    subcategory.id,
    subcategory.name,
    sum(transaction.amount) as amount
  from context
  join selected_category on true
  join public.transactions as transaction
    on transaction.household_id = context.household_id
    and transaction.kind = 'expense'
    and transaction.occurred_on between context.period_from and context.period_to
  join public.subcategories as subcategory
    on subcategory.id = transaction.subcategory_id
    and subcategory.household_id = transaction.household_id
  join public.categories as category
    on category.id = subcategory.category_id
    and category.household_id = transaction.household_id
  where category.id = selected_category.id
  group by subcategory.id, subcategory.name
  order by 3 desc, 2;
$$;
