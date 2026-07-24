create or replace function public.set_household_member_color(target_user_id uuid, target_color text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_household_id uuid;
begin
  select household_id into target_household_id from public.household_members where user_id = target_user_id;
  if target_household_id is null or not private.is_household_member(target_household_id) then raise exception 'Not allowed'; end if;
  if target_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid color'; end if;
  update public.household_members set color = target_color where household_id = target_household_id and user_id = target_user_id;
end;
$$;

revoke execute on function public.set_household_member_color(uuid, text) from public, anon;
grant execute on function public.set_household_member_color(uuid, text) to authenticated;
