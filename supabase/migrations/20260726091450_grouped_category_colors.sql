create or replace function private.category_subcategory_colors(category_color text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case lower(category_color)
    when '#b0e0e6' then array['#c5e8f7', '#aec6cf', '#b4c4d4', '#c9d6df']
    when '#ffb5e8' then array['#ff9cee', '#b28dff', '#c5a3ff', '#e0bbe4']
    when '#f4c2c2' then array['#ffd1dc', '#ffe4e1', '#ffdead', '#ffe4c4']
    when '#e6e6fa' then array['#d8bfd8', '#dda0dd', '#ee82ee', '#e0b0ff']
    when '#ffe5d9' then array['#e8d5c4', '#d4c4b0', '#c9d6df', '#e6e6fa']
    when '#f5f5f0' then array['#e8e8e3', '#d9d9c7', '#c5c5a9', '#b8b8a8']
    else array[]::text[]
  end;
$$;

create or replace function private.next_category_pastel(target_household_id uuid)
returns text
language sql
volatile
set search_path = ''
as $$
  with palette(color) as (
    values ('#b0e0e6'::text), ('#ffb5e8'), ('#f4c2c2'), ('#e6e6fa'), ('#ffe5d9'), ('#f5f5f0')
  ), unused as (
    select color from palette
    where not exists (
      select 1 from public.categories
      where household_id = target_household_id and lower(color) = palette.color
    )
  )
  select color from (select color from unused union all select color from palette where not exists (select 1 from unused)) candidates
  order by random() limit 1;
$$;

with ranked_categories as (
  select id, (row_number() over (partition by household_id order by created_at, id) - 1) % 6 as palette_index
  from public.categories
)
update public.categories category
set color = (array['#b0e0e6', '#ffb5e8', '#f4c2c2', '#e6e6fa', '#ffe5d9', '#f5f5f0'])[ranked_categories.palette_index + 1]
from ranked_categories
where category.id = ranked_categories.id;

alter table public.categories
  drop constraint if exists categories_color_check,
  add constraint categories_color_check check (lower(color) in ('#b0e0e6', '#ffb5e8', '#f4c2c2', '#e6e6fa', '#ffe5d9', '#f5f5f0'));

alter table public.subcategories add column color text;

create or replace function public.assign_subcategory_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_color text;
  palette text[];
  candidates text[];
begin
  select color into parent_color
  from public.categories
  where id = new.category_id and household_id = new.household_id
  for update;

  if parent_color is null then
    raise exception 'Subcategory category must belong to its household';
  end if;

  palette := private.category_subcategory_colors(parent_color);
  if cardinality(palette) = 0 then
    raise exception 'Subcategory category must use a registered color';
  end if;

  if new.color is null then
    select array_agg(color) into candidates
    from unnest(palette) as palette_color(color)
    where not exists (
      select 1 from public.subcategories as subcategory
      where subcategory.category_id = new.category_id
        and lower(subcategory.color) = lower(palette_color.color)
        and subcategory.id is distinct from new.id
    );
    new.color := coalesce((select color from unnest(coalesce(candidates, palette)) color order by random() limit 1), palette[1]);
  elsif not lower(new.color) = any(palette) then
    raise exception 'Subcategory color must belong to its category color family';
  end if;

  return new;
end;
$$;

create trigger subcategories_assign_color
before insert or update of household_id, category_id, color on public.subcategories
for each row execute function public.assign_subcategory_color();

update public.subcategories set color = null;

alter table public.subcategories
  alter column color set not null,
  add constraint subcategories_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');

create function public.create_category(category_name text, category_kind public.category_kind, category_color text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid;
  category_id uuid;
begin
  select household_id into current_household_id
  from public.household_members where user_id = auth.uid();
  if current_household_id is null then raise exception 'Not allowed'; end if;
  category_name := btrim(category_name);
  if char_length(category_name) not between 1 and 80 then raise exception 'Enter a name.'; end if;
  if category_color is not null and lower(category_color) not in ('#b0e0e6', '#ffb5e8', '#f4c2c2', '#e6e6fa', '#ffe5d9', '#f5f5f0') then
    raise exception 'Invalid category color';
  end if;
  insert into public.categories (household_id, name, kind, color)
  values (current_household_id, category_name, category_kind, category_color)
  returning id into category_id;
  return category_id;
end;
$$;

revoke execute on function public.create_category(text, public.category_kind, text) from public, anon;
grant execute on function public.create_category(text, public.category_kind, text) to authenticated;
