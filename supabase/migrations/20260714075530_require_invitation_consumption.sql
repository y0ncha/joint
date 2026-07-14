create or replace function private.consume_matching_invitation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.role = 'member' then
    update public.invitations
    set accepted_at = now()
    where household_id = new.household_id
      and accepted_at is null
      and expires_at > now()
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));

    if not found then
      raise exception 'Matching invitation could not be consumed';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.consume_matching_invitation() from public, anon, authenticated;
