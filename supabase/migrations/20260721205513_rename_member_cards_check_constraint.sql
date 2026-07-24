alter table public.member_cards
  rename constraint member_card_mappings_last_four_check
    to member_cards_last_four_check;
