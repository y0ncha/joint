create function public.reassign_subcategory_colors_on_category_color_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  palette text[];
begin
  palette := private.category_subcategory_colors(new.color);

  update public.subcategories as subcategory
  set color = palette[((child.position - 1) % cardinality(palette)) + 1]
  from (
    select id, row_number() over (order by created_at, id)::integer as position
    from public.subcategories
    where category_id = new.id
  ) as child
  where subcategory.id = child.id;

  return new;
end;
$$;

create trigger categories_reassign_subcategory_colors
after update of color on public.categories
for each row
when (old.color is distinct from new.color)
execute function public.reassign_subcategory_colors_on_category_color_change();
