create or replace function private.category_subcategory_colors(category_color text)
returns text[] language sql immutable set search_path = '' as $$
  select case lower(category_color)
    when '#ccebef' then array['#d9f0fa','#cadae0','#ced9e3','#dce4ea']
    when '#ffcff0' then array['#ffbff4','#cdb5ff','#d9c3ff','#ebd3ed']
    when '#f8d7d7' then array['#ffe1e8','#ffedec','#ffeaca','#ffedd9']
    when '#efeffc' then array['#e6d5e6','#e9c1e9','#f4aef4','#ebccff']
    when '#ffeee6' then array['#f0e4d9','#e3d9cc','#dce4ea','#efeffc']
    when '#d5d5c4' then array['#ecece7','#e2e2dd','#c8c8ad','#bcbcac']
    else array[]::text[] end;
$$;

create or replace function private.next_category_pastel(target_household_id uuid)
returns text language sql volatile set search_path = '' as $$
  with palette(color) as (values ('#ccebef'::text),('#ffcff0'),('#f8d7d7'),('#efeffc'),('#ffeee6'),('#d5d5c4')),
  unused as (select color from palette where not exists (select 1 from public.categories where household_id = target_household_id and lower(color) = palette.color))
  select color from (select color from unused union all select color from palette where not exists (select 1 from unused)) candidates order by random() limit 1;
$$;

alter table public.categories drop constraint categories_color_check;
update public.categories set color = '#d5d5c4' where lower(color) = '#f9f9f5';
update public.subcategories set color = case lower(color)
  when '#f0f0ed' then '#ecece7' when '#e6e6db' then '#e2e2dd' when '#d9d9c7' then '#c8c8ad' when '#d1d1c6' then '#bcbcac' else color end;
alter table public.categories add constraint categories_color_check check (lower(color) in ('#ccebef','#ffcff0','#f8d7d7','#efeffc','#ffeee6','#d5d5c4'));

create or replace function public.create_category(category_name text, category_kind public.category_kind, category_color text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_household_id uuid; category_id uuid;
begin
  select household_id into current_household_id from public.household_members where user_id = auth.uid();
  if current_household_id is null then raise exception 'Not allowed'; end if;
  category_name := btrim(category_name);
  if char_length(category_name) not between 1 and 80 then raise exception 'Enter a name.'; end if;
  if category_color is not null and lower(category_color) not in ('#ccebef','#ffcff0','#f8d7d7','#efeffc','#ffeee6','#d5d5c4') then raise exception 'Invalid category color'; end if;
  insert into public.categories (household_id,name,kind,color) values (current_household_id,category_name,category_kind,category_color) returning id into category_id;
  return category_id;
end;
$$;
