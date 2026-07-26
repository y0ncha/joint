create function public.create_category_with_subcategory(
  category_name text,
  category_kind public.category_kind,
  category_color text,
  subcategory_name text
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
  select household_id
    into current_household_id
    from public.household_members
    where user_id = auth.uid();

  if current_household_id is null then
    raise exception 'Not allowed';
  end if;

  category_name := btrim(category_name);
  subcategory_name := btrim(subcategory_name);
  if char_length(category_name) not between 1 and 80 or char_length(subcategory_name) not between 1 and 80 then
    raise exception 'Enter a name.';
  end if;
  if category_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid color';
  end if;

  insert into public.categories (household_id, name, kind, color)
  values (current_household_id, category_name, category_kind, category_color)
  returning id into category_id;

  insert into public.subcategories (household_id, category_id, name)
  values (current_household_id, category_id, subcategory_name);

  return category_id;
end;
$$;

revoke insert on table public.categories from authenticated;
revoke execute on function public.create_category_with_subcategory(text, public.category_kind, text, text) from public, anon;
grant execute on function public.create_category_with_subcategory(text, public.category_kind, text, text) to authenticated;
