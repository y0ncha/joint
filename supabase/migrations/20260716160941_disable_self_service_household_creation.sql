drop policy "Authenticated users can create households"
on public.households;

revoke insert on table public.households
from public, anon, authenticated;

drop policy "Owners can update household partner authorization"
on public.household_allowed_members;

revoke update on table public.household_allowed_members
from public, anon, authenticated;

-- This function is a trigger-only operator provisioning mechanism, not an RPC.
revoke execute on function public.add_household_owner()
from public, anon, authenticated;
