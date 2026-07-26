alter table public.subcategories
  add column icon text,
  add constraint subcategories_icon_check check (
    icon is null or icon in (
      'tag', 'shopping-basket', 'utensils', 'coffee', 'home', 'car', 'bus', 'fuel', 'heart-pulse', 'pill', 'dumbbell', 'graduation-cap',
      'book-open', 'gift', 'shirt', 'gamepad-2', 'plane', 'hotel', 'smartphone', 'wifi', 'lightbulb', 'wrench', 'shield-check', 'paw-print',
      'baby', 'users', 'landmark', 'receipt', 'wallet-cards', 'banknote', 'circle-dollar-sign', 'briefcase-business', 'hand-coins', 'sparkles'
    )
  );
