create or replace function private.category_subcategory_colors(category_color text)
returns text[] language sql immutable set search_path = '' as $$
  select case lower(category_color)
    when '#ccebef' then array['#d9f0fa','#cadae0','#ced9e3','#dce4ea']
    when '#ffcff0' then array['#ffbff4','#cdb5ff','#d9c3ff','#ebd3ed']
    when '#f8d7d7' then array['#ffe1e8','#ffedec','#ffeaca','#ffedd9']
    when '#efeffc' then array['#e6d5e6','#e9c1e9','#f4aef4','#ebccff']
    when '#ffeee6' then array['#f0e4d9','#e3d9cc','#dce4ea','#efeffc']
    when '#f9f9f5' then array['#f0f0ed','#e6e6db','#d9d9c7','#d1d1c6']
    else array[]::text[] end;
$$;

create or replace function private.next_category_pastel(target_household_id uuid)
returns text language sql volatile set search_path = '' as $$
  with palette(color) as (values ('#ccebef'::text),('#ffcff0'),('#f8d7d7'),('#efeffc'),('#ffeee6'),('#f9f9f5')),
  unused as (select color from palette where not exists (select 1 from public.categories where household_id = target_household_id and lower(color) = palette.color))
  select color from (select color from unused union all select color from palette where not exists (select 1 from unused)) candidates order by random() limit 1;
$$;

alter table public.categories drop constraint categories_color_check;

update public.categories set color = case lower(color)
  when '#b0e0e6' then '#ccebef' when '#ffb5e8' then '#ffcff0' when '#f4c2c2' then '#f8d7d7'
  when '#e6e6fa' then '#efeffc' when '#ffe5d9' then '#ffeee6' when '#f5f5f0' then '#f9f9f5' else color end;

update public.subcategories set color = case lower(color)
  when '#c5e8f7' then '#d9f0fa' when '#aec6cf' then '#cadae0' when '#b4c4d4' then '#ced9e3' when '#c9d6df' then '#dce4ea'
  when '#ff9cee' then '#ffbff4' when '#b28dff' then '#cdb5ff' when '#c5a3ff' then '#d9c3ff' when '#e0bbe4' then '#ebd3ed'
  when '#ffd1dc' then '#ffe1e8' when '#ffe4e1' then '#ffedec' when '#ffdead' then '#ffeaca' when '#ffe4c4' then '#ffedd9'
  when '#d8bfd8' then '#e6d5e6' when '#dda0dd' then '#e9c1e9' when '#ee82ee' then '#f4aef4' when '#e0b0ff' then '#ebccff'
  when '#e8d5c4' then '#f0e4d9' when '#d4c4b0' then '#e3d9cc' when '#e8e8e3' then '#f0f0ed' when '#d9d9c7' then '#e6e6db'
  when '#c5c5a9' then '#d9d9c7' when '#b8b8a8' then '#d1d1c6' else color end;

alter table public.categories add constraint categories_color_check check (lower(color) in ('#ccebef','#ffcff0','#f8d7d7','#efeffc','#ffeee6','#f9f9f5'));

create or replace function public.create_category(category_name text, category_kind public.category_kind, category_color text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_household_id uuid; category_id uuid;
begin
  select household_id into current_household_id from public.household_members where user_id = auth.uid();
  if current_household_id is null then raise exception 'Not allowed'; end if;
  category_name := btrim(category_name);
  if char_length(category_name) not between 1 and 80 then raise exception 'Enter a name.'; end if;
  if category_color is not null and lower(category_color) not in ('#ccebef','#ffcff0','#f8d7d7','#efeffc','#ffeee6','#f9f9f5') then raise exception 'Invalid category color'; end if;
  insert into public.categories (household_id,name,kind,color) values (current_household_id,category_name,category_kind,category_color) returning id into category_id;
  return category_id;
end;
$$;
