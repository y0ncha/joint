-- RLS policy expressions execute this private helper as the caller. The helper
-- remains security-definer and private, but authenticated users need EXECUTE
-- for the owner-only policy to evaluate.
grant execute on function private.household_member_count(uuid) to authenticated;
