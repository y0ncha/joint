alter table public.categories
  drop constraint if exists categories_color_palette_check,
  drop constraint if exists categories_color_check,
  add constraint categories_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');
