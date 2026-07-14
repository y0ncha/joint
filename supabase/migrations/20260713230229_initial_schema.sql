create extension if not exists pgcrypto;

create type public.account_kind as enum ('bank', 'credit_card');
create type public.category_kind as enum ('income', 'expense');
create type public.transaction_kind as enum ('income', 'expense', 'transfer');
create type public.household_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind public.account_kind not null,
  opening_balance numeric(12, 2) not null check (opening_balance >= 0),
  opening_balance_date date not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind public.category_kind not null,
  color text not null default '#0f6b54' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, kind, name)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind public.transaction_kind not null,
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null,
  note text not null default '' check (char_length(note) <= 500),
  account_id uuid not null references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'transfer' and category_id is null and destination_account_id is not null and destination_account_id <> account_id)
    or (kind in ('income', 'expense') and category_id is not null and destination_account_id is null)
  )
);

create index accounts_household_id_idx on public.accounts (household_id);
create index categories_household_id_idx on public.categories (household_id);
create index transactions_household_occurred_on_idx on public.transactions (household_id, occurred_on desc);
create index transactions_account_occurred_on_idx on public.transactions (account_id, occurred_on desc);
create index transactions_category_occurred_on_idx on public.transactions (category_id, occurred_on desc) where category_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger households_set_updated_at before update on public.households for each row execute procedure public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts for each row execute procedure public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute procedure public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute procedure public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.add_household_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_household_created after insert on public.households for each row execute procedure public.add_household_owner();

create function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create function public.validate_transaction_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  account_household uuid;
  account_type public.account_kind;
  destination_household uuid;
  destination_type public.account_kind;
  category_household uuid;
  category_type public.category_kind;
begin
  select household_id, kind into account_household, account_type from public.accounts where id = new.account_id;
  if account_household is null or account_household <> new.household_id then
    raise exception 'Transaction account must belong to its household';
  end if;

  if new.destination_account_id is not null then
    select household_id, kind into destination_household, destination_type from public.accounts where id = new.destination_account_id;
    if destination_household is null or destination_household <> new.household_id then
      raise exception 'Transfer destination must belong to its household';
    end if;
  end if;

  if new.kind = 'income' and account_type <> 'bank' then
    raise exception 'Income must be received by a bank account';
  end if;
  if new.kind = 'transfer' and (account_type <> 'bank' or destination_type <> 'credit_card') then
    raise exception 'Transfers must settle a credit card from a bank account';
  end if;

  if new.category_id is not null then
    select household_id, kind into category_household, category_type from public.categories where id = new.category_id;
    if category_household is null or category_household <> new.household_id then
      raise exception 'Transaction category must belong to its household';
    end if;
    if category_type::text <> new.kind::text then
      raise exception 'Transaction category kind must match transaction kind';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_validate_links before insert or update on public.transactions for each row execute procedure public.validate_transaction_links();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "Users can read their profile" on public.profiles for select using (id = auth.uid());
create policy "Users can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Members can read households" on public.households for select using (public.is_household_member(id));
create policy "Authenticated users can create households" on public.households for insert with check (created_by = auth.uid());
create policy "Owners can update households" on public.households for update using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy "Members can read memberships" on public.household_members for select using (public.is_household_member(household_id));
create policy "Owners can manage memberships" on public.household_members for all using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "Owners can manage invitations" on public.invitations for all using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "Members can manage accounts" on public.accounts for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Members can manage categories" on public.categories for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Members can manage transactions" on public.transactions for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
