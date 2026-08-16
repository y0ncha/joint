#!/usr/bin/env bash
set -euo pipefail

db_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
if command -v psql >/dev/null 2>&1; then
  psql_cmd=(psql "$db_url")
else
  psql_cmd=(docker exec -i supabase_db_Joint psql -U postgres -d postgres)
fi
household_id='00000000-0000-0000-0000-000000000670'
user_id='00000000-0000-0000-0000-000000000671'
schedule_id='00000000-0000-0000-0000-000000000672'
transaction_id='00000000-0000-0000-0000-000000000673'
lock_log="$(mktemp)"
save_log="$(mktemp)"
trap 'rm -f "$lock_log" "$save_log"' EXIT

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values ('$user_id', 'recurring-lock@example.test', now(), '{"provider":"google"}')
on conflict (id) do nothing;
insert into public.households (id, name, created_by)
values ('$household_id', 'Recurring lock household', '$user_id')
on conflict (id) do nothing;
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on, status
)
values (
  '$schedule_id', '$household_id', '$user_id', 'expense', 10, 'Lock probe', '',
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  current_date, 'weekly', 1, 1, current_date + 7, 'active'
)
on conflict (id) do nothing;
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, recurring_schedule_id, scheduled_for
)
values (
  '$transaction_id', '$household_id', '$user_id', 'expense', 10, current_date,
  'Lock probe', '',
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  '$schedule_id', current_date
)
on conflict (id) do nothing;
SQL

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "begin; select id from public.recurring_transaction_schedules where id = '$schedule_id' for update; select pg_sleep(2); commit;" \
  >"$lock_log" 2>&1 &
lock_pid=$!
sleep 0.2

start_seconds="$(date +%s)"
"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL >"$save_log" 2>&1
set role authenticated;
set request.jwt.claim.sub = '$user_id';
select public.save_recurring_transaction_occurrence(
  '$transaction_id', 'this', 'expense', 11, current_date,
  'Lock probe saved', '', null,
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  null, null, null, null, null
);
SQL
end_seconds="$(date +%s)"
wait "$lock_pid"

elapsed_seconds=$((end_seconds - start_seconds))
if (( elapsed_seconds < 1 )); then
  echo "lock-order check failed: save RPC did not wait for the schedule lock"
  cat "$lock_log" "$save_log"
  exit 1
fi

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "delete from public.transactions where id = '$transaction_id'; delete from public.recurring_transaction_schedules where id = '$schedule_id';" \
  >/dev/null

echo "lock-order check passed: schedule-first save waited ${elapsed_seconds}s for the concurrent schedule lock"
