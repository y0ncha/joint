alter table public.member_card_mappings rename to member_cards;

alter table public.member_cards
  rename constraint member_card_mappings_pkey to member_cards_pkey;

alter table public.member_cards
  rename constraint member_card_mappings_household_id_user_id_fkey
    to member_cards_household_id_user_id_fkey;

alter table public.member_cards
  rename constraint member_card_mappings_household_id_last_four_key
    to member_cards_household_id_last_four_key;
