begin;

do $$
begin
  if exists (
    select 1
    from public.accounts
    where archived_at is not null
  ) then
    raise exception 'Shared-balance migration does not support archived accounts';
  end if;
end;
$$;

alter table public.households
  add column opening_balance numeric(12, 2);

update public.households as household
set opening_balance = (
  select coalesce(
    sum(
      case
        when account.kind = 'bank' then account.opening_balance
        else -account.opening_balance
      end
    ) filter (where account.archived_at is null),
    0
  )
  from public.accounts as account
  where account.household_id = household.id
);

alter table public.households
  alter column opening_balance set not null,
  alter column opening_balance set default 0;

delete from public.transactions
where kind = 'transfer';

drop trigger transactions_validate_links on public.transactions;
drop function public.validate_transaction_links();

alter table public.transactions
  drop constraint transactions_check;

drop index public.transactions_account_occurred_on_idx;

alter table public.transactions
  drop column destination_account_id,
  drop column account_id;

alter type public.transaction_kind rename to transaction_kind_with_transfer;
create type public.transaction_kind as enum ('income', 'expense');

alter table public.transactions
  alter column kind type public.transaction_kind
  using kind::text::public.transaction_kind;

drop type public.transaction_kind_with_transfer;

alter table public.transactions
  add constraint transactions_category_required_check
  check (category_id is not null);

create function public.validate_transaction_category()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  category_household uuid;
  category_type public.category_kind;
begin
  select household_id, kind
  into category_household, category_type
  from public.categories
  where id = new.category_id;

  if category_household is null or category_household <> new.household_id then
    raise exception 'Transaction category must belong to its household';
  end if;

  if category_type::text <> new.kind::text then
    raise exception 'Transaction category kind must match transaction kind';
  end if;

  return new;
end;
$$;

create trigger transactions_validate_category
before insert or update on public.transactions
for each row execute function public.validate_transaction_category();

drop table public.accounts cascade;
drop type public.account_kind;

do $$
begin
  if exists (
    select 1
    from public.households
    where opening_balance is null
  ) then
    raise exception 'Shared-balance migration left a household without an opening balance';
  end if;

  if exists (
    select 1
    from public.transactions
    where kind::text not in ('income', 'expense')
      or category_id is null
  ) then
    raise exception 'Shared-balance migration left an invalid transaction';
  end if;
end;
$$;

commit;
