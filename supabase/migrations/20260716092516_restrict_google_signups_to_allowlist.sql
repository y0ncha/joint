create table private.allowed_google_signin_emails (
  email text primary key check (email = lower(trim(email)))
);

alter table private.allowed_google_signin_emails enable row level security;

create policy "Supabase Auth can read allowed Google sign-in emails"
on private.allowed_google_signin_emails
for select
to supabase_auth_admin
using (true);

insert into private.allowed_google_signin_emails (email)
values
  ('yonacs@gmail.com'),
  ('e.nestrenko@gmail.com');

revoke all on table private.allowed_google_signin_emails from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant select on table private.allowed_google_signin_emails to supabase_auth_admin;

create function public.before_user_created_google_allowlist(event jsonb)
returns jsonb
language plpgsql
set search_path = pg_catalog, private
as $$
declare
  normalized_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
  provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if provider <> 'google'
    or normalized_email = ''
    or not exists (
      select 1
      from private.allowed_google_signin_emails
      where email = normalized_email
    ) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'message', 'Access denied.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_google_allowlist(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created_google_allowlist(jsonb) from public, anon, authenticated;
