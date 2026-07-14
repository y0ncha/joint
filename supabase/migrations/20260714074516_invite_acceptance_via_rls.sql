drop function if exists public.accept_household_invitation(uuid);

create policy "Invitees can read their active invitation"
on public.invitations for select to authenticated
using (
  accepted_at is null
  and expires_at > now()
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy "Invitees can join their invited household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and exists (
    select 1 from public.invitations
    where invitations.household_id = household_members.household_id
      and invitations.accepted_at is null
      and invitations.expires_at > now()
      and lower(invitations.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create function private.consume_matching_invitation()
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
  end if;
  return new;
end;
$$;

revoke execute on function private.consume_matching_invitation() from public, anon, authenticated;

create trigger household_members_consume_invitation
after insert on public.household_members
for each row execute function private.consume_matching_invitation();
