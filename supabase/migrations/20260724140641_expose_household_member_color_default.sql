alter table public.household_members
  alter column color set default nullif(''::text, ''::text);
