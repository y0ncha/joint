create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

create extension if not exists "pgtap" with schema "extensions";

drop extension if exists "pg_net";

drop function if exists "public"."set_household_member_color"(target_user_id uuid, target_color text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

CREATE OR REPLACE FUNCTION public.set_current_household_member_color(target_color text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_household_id uuid;
begin
  select household_id into target_household_id from public.household_members where user_id = auth.uid();
  if target_household_id is null or not private.is_household_member(target_household_id) then raise exception 'Not allowed'; end if;
  if target_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid color'; end if;
  update public.household_members set color = target_color where household_id = target_household_id and user_id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_category_color()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.color is null then new.color := private.next_household_pastel(new.household_id, 'public.categories'::regclass); end if;
  return new;
end;
$function$
;

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."household_allowed_members" to "anon";

grant insert on table "public"."household_allowed_members" to "anon";

grant select on table "public"."household_allowed_members" to "anon";

grant delete on table "public"."household_allowed_members" to "service_role";

grant insert on table "public"."household_allowed_members" to "service_role";

grant select on table "public"."household_allowed_members" to "service_role";

grant update on table "public"."household_allowed_members" to "service_role";

grant delete on table "public"."household_members" to "anon";

grant insert on table "public"."household_members" to "anon";

grant select on table "public"."household_members" to "anon";

grant update on table "public"."household_members" to "anon";

grant delete on table "public"."household_members" to "authenticated";

grant insert on table "public"."household_members" to "authenticated";

grant select on table "public"."household_members" to "authenticated";

grant update on table "public"."household_members" to "authenticated";

grant delete on table "public"."household_members" to "service_role";

grant insert on table "public"."household_members" to "service_role";

grant select on table "public"."household_members" to "service_role";

grant update on table "public"."household_members" to "service_role";

grant delete on table "public"."households" to "anon";

grant select on table "public"."households" to "anon";

grant update on table "public"."households" to "anon";

grant delete on table "public"."households" to "authenticated";

grant select on table "public"."households" to "authenticated";

grant update on table "public"."households" to "authenticated";

grant delete on table "public"."households" to "service_role";

grant insert on table "public"."households" to "service_role";

grant select on table "public"."households" to "service_role";

grant update on table "public"."households" to "service_role";

grant delete on table "public"."member_cards" to "service_role";

grant insert on table "public"."member_cards" to "service_role";

grant select on table "public"."member_cards" to "service_role";

grant update on table "public"."member_cards" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."transactions" to "anon";

grant insert on table "public"."transactions" to "anon";

grant select on table "public"."transactions" to "anon";

grant update on table "public"."transactions" to "anon";

grant delete on table "public"."transactions" to "authenticated";

grant insert on table "public"."transactions" to "authenticated";

grant select on table "public"."transactions" to "authenticated";

grant update on table "public"."transactions" to "authenticated";

grant delete on table "public"."transactions" to "service_role";

grant insert on table "public"."transactions" to "service_role";

grant select on table "public"."transactions" to "service_role";

grant update on table "public"."transactions" to "service_role";
