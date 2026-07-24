-- Shared ledger colors. Members and categories accept any hex color.
alter table public.household_members
  add column color text;

with ranked_members as (
  select household_id, user_id,
    row_number() over (partition by household_id order by joined_at, user_id) - 1 as palette_index
  from public.household_members
)
update public.household_members member
set color = (array['#dcece3', '#dcecf2', '#ece5f4', '#f6e3dc', '#f5e2eb'])[ranked_members.palette_index % 5 + 1]
from ranked_members
where member.household_id = ranked_members.household_id
  and member.user_id = ranked_members.user_id;

alter table public.household_members
  alter column color set not null,
  add constraint household_members_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.categories
  drop constraint if exists categories_color_check,
  add constraint categories_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function private.next_household_pastel(target_household_id uuid, target_table regclass)
returns text
language sql
stable
set search_path = ''
as $$
  with palette(color, position) as (
    values ('#dcece3'::text, 1), ('#dcecf2', 2), ('#ece5f4', 3), ('#f6e3dc', 4), ('#f5e2eb', 5)
  ), used as (
    select color from public.household_members where household_id = target_household_id
    union
    select color from public.categories where household_id = target_household_id
  )
  select palette.color from palette left join used using (color)
  order by (used.color is not null), position limit 1;
$$;

create or replace function public.assign_household_member_color()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.color is null then new.color := private.next_household_pastel(new.household_id, 'public.household_members'::regclass); end if;
  return new;
end;
$$;
create trigger household_members_assign_color before insert on public.household_members for each row execute function public.assign_household_member_color();

create or replace function public.assign_category_color()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.color is null then new.color := (array['#dcece3', '#dcecf2', '#ece5f4', '#f6e3dc', '#f5e2eb'])[floor(random() * 5)::integer + 1]; end if;
  return new;
end;
$$;
alter table public.categories alter column color drop default;
create trigger categories_assign_color before insert on public.categories for each row execute function public.assign_category_color();

create or replace function public.set_household_member_color(target_user_id uuid, target_color text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_household_id uuid;
begin
  select household_id into target_household_id from public.household_members where user_id = target_user_id;
  if target_household_id is null or not private.is_household_member(target_household_id) then raise exception 'Not allowed'; end if;
  if target_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid color'; end if;
  update public.household_members set color = target_color where household_id = target_household_id and user_id = target_user_id;
end;
$$;
revoke execute on function public.set_household_member_color(uuid, text) from public, anon;
grant execute on function public.set_household_member_color(uuid, text) to authenticated;
