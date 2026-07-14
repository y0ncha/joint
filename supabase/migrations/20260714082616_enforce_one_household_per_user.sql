alter table public.household_members
  add constraint household_members_user_id_key unique (user_id);
