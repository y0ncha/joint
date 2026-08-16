#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

db_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
if command -v psql >/dev/null 2>&1; then
  psql_cmd=(psql "$db_url")
else
  psql_cmd=(docker exec -i supabase_db_Joint psql -U postgres -d postgres)
fi

work_dir="$(mktemp -d)"
restore_needed=true
cleanup() {
  status=$?
  if [[ "$restore_needed" == true ]]; then
    set +e
    SUPABASE_TELEMETRY_DISABLED=1 supabase db reset --local --yes >"$work_dir/restore.log" 2>&1
    restore_status=$?
    set -e
    if ((restore_status != 0 && status == 0)); then
      status=$restore_status
    fi
  fi
  rm -rf "$work_dir"
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

run_sql() {
  "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 "$@"
}

reset_to_legacy_schema() {
  SUPABASE_TELEMETRY_DISABLED=1 supabase db reset --local --yes >"$work_dir/start-reset.log" 2>&1
  SUPABASE_TELEMETRY_DISABLED=1 supabase migration down --local --last 2 --yes >"$work_dir/migration-down.log" 2>&1
}

assert_rollback() {
  local schedule_id="$1"
  local state
  state="$(run_sql -At -c "
    select
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'recurring_transaction_schedules'
          and column_name = 'first_occurrence_transaction_id'
      )
      and not exists (
        select 1 from pg_catalog.pg_type where typnamespace = 'public'::regnamespace
          and typname = 'recurring_schedule_status'
      )
      and (select count(*) from public.recurring_transaction_schedules where id = '$schedule_id') = 1;")"
  if [[ "$state" != "t" ]]; then
    echo "backfill harness failed: migration rollback state was not preserved for $schedule_id"
    exit 1
  fi
}

expect_migration_abort() {
  local label="$1"
  local schedule_id="$2"
  local log="$work_dir/$label.log"
  local exit_status

  set +e
  SUPABASE_TELEMETRY_DISABLED=1 supabase migration up --local >"$log" 2>&1
  exit_status=$?
  set -e
  if ((exit_status == 0)); then
    cat "$log"
    echo "backfill harness failed: $label migration unexpectedly succeeded"
    exit 1
  fi
  assert_rollback "$schedule_id"
  echo "migration abort $label: exit=$exit_status, legacy pointer retained, target migration rolled back"
}

reset_to_legacy_schema

owner_one='00000000-0000-0000-0000-00000000e701'
owner_two='00000000-0000-0000-0000-00000000e702'
household_one='00000000-0000-0000-0000-00000000e710'
household_two='00000000-0000-0000-0000-00000000e711'
household_schedule='00000000-0000-0000-0000-00000000e730'
household_occurrence='00000000-0000-0000-0000-00000000e731'
source_schedule='00000000-0000-0000-0000-00000000e732'
source_occurrence='00000000-0000-0000-0000-00000000e733'
link_schedule='00000000-0000-0000-0000-00000000e734'
link_occurrence='00000000-0000-0000-0000-00000000e735'
link_target_schedule='00000000-0000-0000-0000-00000000e736'
collision_schedule='00000000-0000-0000-0000-00000000e737'
collision_pointer='00000000-0000-0000-0000-00000000e738'
collision_occurrence='00000000-0000-0000-0000-00000000e739'

run_sql <<SQL
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values
  ('$owner_one', 'recurring-backfill-one@example.test', now(), '{"provider":"google"}'),
  ('$owner_two', 'recurring-backfill-two@example.test', now(), '{"provider":"google"}')
on conflict (id) do nothing;
insert into public.households (id, name, created_by)
values
  ('$household_one', 'Recurring backfill household one', '$owner_one'),
  ('$household_two', 'Recurring backfill household two', '$owner_two')
on conflict (id) do nothing;
SQL

category_one="$(run_sql -At -c "select id from public.categories where household_id = '$household_one' and system_key = 'other_expense'")"
category_two="$(run_sql -At -c "select id from public.categories where household_id = '$household_two' and system_key = 'other_expense'")"

run_sql <<SQL
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source
)
values (
  '$household_occurrence', '$household_two', '$owner_two', 'expense', 10, current_date - 7,
  'Household mismatch', '', '$category_two', 'manual'
);
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on,
  enabled, first_occurrence_transaction_id
)
values (
  '$household_schedule', '$household_one', '$owner_one', 'expense', 10, 'Household mismatch', '',
  '$category_one', current_date - 7, 'weekly', 1, 1, current_date, true, '$household_occurrence'
);
SQL
expect_migration_abort household-mismatch "$household_schedule"

run_sql <<SQL
delete from public.transactions where id = '$household_occurrence';
delete from public.recurring_transaction_schedules where id = '$household_schedule';
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source, import_file_hash, import_row_number
)
values (
  '$source_occurrence', '$household_one', '$owner_one', 'expense', 11, current_date - 7,
  'Source mismatch', '', '$category_one', 'statement_import',
  repeat('b', 64), 1
);
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on,
  enabled, first_occurrence_transaction_id
)
values (
  '$source_schedule', '$household_one', '$owner_one', 'expense', 11, 'Source mismatch', '',
  '$category_one', current_date - 7, 'weekly', 1, 1, current_date, true, '$source_occurrence'
);
SQL
expect_migration_abort source-mismatch "$source_schedule"

run_sql <<SQL
delete from public.transactions where id = '$source_occurrence';
delete from public.recurring_transaction_schedules where id = '$source_schedule';
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on,
  enabled
)
values (
  '$link_target_schedule', '$household_one', '$owner_one', 'expense', 12, 'Link target', '',
  '$category_one', current_date - 7, 'weekly', 1, 1, current_date, true
);
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on,
  enabled
)
values (
  '$link_schedule', '$household_one', '$owner_one', 'expense', 12, 'Link mismatch', '',
  '$category_one', current_date - 7, 'weekly', 1, 1, current_date, true
);
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source, recurring_schedule_id
)
values (
  '$link_occurrence', '$household_one', '$owner_one', 'expense', 12, current_date - 7,
  'Link mismatch', '', '$category_one', 'manual', '$link_target_schedule'
);
update public.recurring_transaction_schedules
set first_occurrence_transaction_id = '$link_occurrence'
where id = '$link_schedule';
SQL
expect_migration_abort link-mismatch "$link_schedule"

run_sql <<SQL
delete from public.transactions where id = '$link_occurrence';
delete from public.recurring_transaction_schedules
where id in ('$link_schedule', '$link_target_schedule');
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on,
  enabled
)
values (
  '$collision_schedule', '$household_one', '$owner_one', 'expense', 13, 'Anchor collision', '',
  '$category_one', current_date - 7, 'weekly', 1, 1, current_date, true
);
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source
)
values (
  '$collision_pointer', '$household_one', '$owner_one', 'expense', 13, current_date - 7,
  'Anchor collision', '', '$category_one', 'manual'
);
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, source, recurring_schedule_id, scheduled_for
)
values (
  '$collision_occurrence', '$household_one', '$owner_one', 'expense', 13, current_date - 7,
  'Anchor collision', '', '$category_one', 'manual', '$collision_schedule', current_date - 7
);
update public.recurring_transaction_schedules
set first_occurrence_transaction_id = '$collision_pointer'
where id = '$collision_schedule';
SQL
expect_migration_abort anchor-collision "$collision_schedule"

run_sql <<SQL
delete from public.transactions where id in ('$collision_pointer', '$collision_occurrence');
delete from public.recurring_transaction_schedules where id = '$collision_schedule';
SQL

SUPABASE_TELEMETRY_DISABLED=1 supabase migration up --local >"$work_dir/migration-success.log" 2>&1
echo "backfill harness passed: actual migration aborted and rolled back household/source/link mismatch and anchor-collision fixtures, then applied cleanly"
