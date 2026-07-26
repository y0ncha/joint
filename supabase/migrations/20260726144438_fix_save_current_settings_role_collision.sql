create or replace function public.save_current_settings(profile_name text, household_name text, member_color text, member_card_last_four text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_household_id uuid;
  current_member_role public.household_role;
begin
  select household_id, role
    into current_household_id, current_member_role
    from public.household_members
    where user_id = current_user_id;

  if current_household_id is null then
    raise exception 'Not allowed';
  end if;

  if profile_name is not null then
    profile_name := btrim(profile_name);
    if profile_name = '' then
      raise exception 'Enter a display name.';
    end if;
  end if;

  if household_name is not null then
    household_name := btrim(household_name);
    if household_name = '' then
      raise exception 'Enter a display name.';
    end if;
    if current_member_role <> 'owner' then
      raise exception 'Only the household owner can change its name.';
    end if;
  end if;

  if member_color is not null and member_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid color';
  end if;

  if member_card_last_four is not null and member_card_last_four !~ '^[0-9]{4}$' then
    raise exception 'Enter exactly four digits.';
  end if;

  if profile_name is not null then
    update public.profiles set full_name = profile_name where id = current_user_id;
  end if;
  if household_name is not null then
    update public.households set name = household_name where id = current_household_id;
  end if;
  if member_color is not null then
    update public.household_members set color = member_color where household_id = current_household_id and user_id = current_user_id;
  end if;
  if member_card_last_four is not null then
    insert into public.member_cards (household_id, user_id, last_four)
    values (current_household_id, current_user_id, member_card_last_four)
    on conflict (household_id, user_id) do update set last_four = excluded.last_four;
  end if;

  return coalesce(profile_name, (select full_name from public.profiles where id = current_user_id));
end;
$$;
