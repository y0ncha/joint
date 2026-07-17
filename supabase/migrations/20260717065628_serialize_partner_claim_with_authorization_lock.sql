create or replace function private.lock_and_validate_partner_claim()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  signed_in_user uuid := auth.uid();
  signed_in_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if new.role = 'owner' or signed_in_user is null then
    perform 1
    from public.households
    where id = new.household_id
    for update;

    if private.household_member_count(new.household_id) >= 2 then
      raise exception 'A household can have at most two members';
    end if;

    return new;
  end if;

  if new.user_id <> signed_in_user
    or new.role <> 'member'
    or (auth.jwt() -> 'app_metadata' ->> 'provider') is distinct from 'google' then
    raise exception using
      errcode = '42501',
      message = 'new row violates row-level security policy for table "household_members"';
  end if;

  perform 1
  from public.household_allowed_members
  where household_id = new.household_id
    and email = signed_in_email
  for key share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Partner authorization is required';
  end if;

  perform 1
  from public.households
  where id = new.household_id
  for update;

  if private.household_member_count(new.household_id) >= 2 then
    raise exception 'A household can have at most two members';
  end if;

  return new;
end;
$$;
