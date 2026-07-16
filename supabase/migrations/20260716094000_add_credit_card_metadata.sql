alter table public.accounts
  add column last_four_digits text,
  add column statement_close_day smallint;

alter table public.accounts
  add constraint accounts_credit_card_metadata_check
  check (
    kind <> 'credit_card'
    or (last_four_digits ~ '^[0-9]{4}$' and statement_close_day between 1 and 31)
  ) not valid;
