alter table public.household_members
  drop constraint if exists household_members_color_palette_check,
  drop constraint if exists household_members_color_check,
  add constraint household_members_color_check check (color ~ '^#[0-9A-Fa-f]{6}$');
