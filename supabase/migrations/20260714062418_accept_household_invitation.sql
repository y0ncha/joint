create function public.accept_household_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_record public.invitations%rowtype;
  signed_in_user uuid := auth.uid();
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if signed_in_user is null then
    raise exception 'Sign in is required';
  end if;

  select * into invitation_record
  from public.invitations
  where token = invitation_token
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found or lower(invitation_record.email) <> signed_in_email then
    raise exception 'Invitation does not belong to the signed-in email';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invitation_record.household_id, signed_in_user, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now()
  where id = invitation_record.id;

  return invitation_record.household_id;
end;
$$;

revoke execute on function public.accept_household_invitation(uuid) from public, anon;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
