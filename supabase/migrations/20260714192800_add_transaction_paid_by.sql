alter table public.transactions
  add column if not exists paid_by uuid references public.profiles(id);

update public.transactions
set paid_by = created_by
where paid_by is null;

alter table public.transactions
  alter column paid_by set not null;

create or replace function public.validate_transaction_paid_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.household_members
    where household_id = new.household_id
      and user_id = new.paid_by
  ) then
    raise exception 'Transaction payer must belong to its household';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_paid_by on public.transactions;
create trigger transactions_validate_paid_by
before insert or update on public.transactions
for each row execute procedure public.validate_transaction_paid_by();
