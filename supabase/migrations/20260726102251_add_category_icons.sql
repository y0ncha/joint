alter table public.categories
  add column icon text not null default 'tag',
  add constraint categories_icon_check check (icon in (
    'tag', 'shopping-basket', 'utensils', 'coffee', 'home', 'car', 'bus', 'fuel', 'heart-pulse', 'pill', 'dumbbell', 'graduation-cap',
    'book-open', 'gift', 'shirt', 'gamepad-2', 'plane', 'hotel', 'smartphone', 'wifi', 'lightbulb', 'wrench', 'shield-check', 'paw-print',
    'baby', 'users', 'landmark', 'receipt', 'wallet-cards', 'banknote', 'circle-dollar-sign', 'briefcase-business', 'hand-coins', 'sparkles'
  ));

drop function public.create_category(text, public.category_kind, text);

create function public.create_category(
  category_name text,
  category_kind public.category_kind,
  category_color text default null,
  category_icon text default 'tag'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid;
  category_id uuid;
begin
  select household_id into current_household_id from public.household_members where user_id = auth.uid();
  if current_household_id is null then raise exception 'Not allowed'; end if;
  category_name := btrim(category_name);
  if char_length(category_name) not between 1 and 80 then raise exception 'Enter a name.'; end if;
  if category_color is not null and lower(category_color) not in ('#ccebef','#ffcff0','#f8d7d7','#efeffc','#ffeee6','#d5d5c4') then raise exception 'Invalid category color'; end if;
  if category_icon not in (
    'tag', 'shopping-basket', 'utensils', 'coffee', 'home', 'car', 'bus', 'fuel', 'heart-pulse', 'pill', 'dumbbell', 'graduation-cap',
    'book-open', 'gift', 'shirt', 'gamepad-2', 'plane', 'hotel', 'smartphone', 'wifi', 'lightbulb', 'wrench', 'shield-check', 'paw-print',
    'baby', 'users', 'landmark', 'receipt', 'wallet-cards', 'banknote', 'circle-dollar-sign', 'briefcase-business', 'hand-coins', 'sparkles'
  ) then raise exception 'Invalid category icon'; end if;
  insert into public.categories (household_id, name, kind, color, icon)
  values (current_household_id, category_name, category_kind, category_color, category_icon)
  returning id into category_id;
  return category_id;
end;
$$;

revoke execute on function public.create_category(text, public.category_kind, text, text) from public, anon;
grant execute on function public.create_category(text, public.category_kind, text, text) to authenticated;
