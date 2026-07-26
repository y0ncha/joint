alter table public.transactions
  drop constraint transactions_household_id_subcategory_id_fkey,
  drop constraint transactions_subcategory_required_check,
  add constraint transactions_household_id_subcategory_id_fkey
    foreign key (household_id, subcategory_id)
    references public.subcategories (household_id, id)
    on delete set null (subcategory_id);
