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
adapter_schedule_id='00000000-0000-0000-0000-000000000674'
adapter_transaction_id='00000000-0000-0000-0000-000000000675'
late_category_id='00000000-0000-0000-0000-000000000676'
late_schedule_id='00000000-0000-0000-0000-000000000677'
idempotency_category_id='00000000-0000-0000-0000-000000000678'
idempotency_schedule_id='00000000-0000-0000-0000-000000000679'
late_subcategory_id='00000000-0000-0000-0000-000000000680'
idempotency_subcategory_id='00000000-0000-0000-0000-000000000681'
ready_class_id='60117'
ready_object_id='672'
adapter_ready_object_id='674'
late_ready_object_id='676'
lock_log="$(mktemp)"
save_log="$(mktemp)"
adapter_lock_log="$(mktemp)"
adapter_save_log="$(mktemp)"
late_lock_log="$(mktemp)"
late_processor_log="$(mktemp)"
idempotency_log_one="$(mktemp)"
idempotency_log_two="$(mktemp)"
trap 'rm -f "$lock_log" "$save_log" "$adapter_lock_log" "$adapter_save_log" "$late_lock_log" "$late_processor_log" "$idempotency_log_one" "$idempotency_log_two"' EXIT

wait_for_ready() {
  local lock_pid="$1"
  local object_id="$2"
  local label="$3"
  local ready
  for _ in $(seq 1 100); do
    ready="$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
      "select exists (select 1 from pg_locks where locktype = 'advisory' and classid = $ready_class_id and objid = $object_id and granted);")"
    if [[ "$ready" == "t" ]]; then
      return
    fi
    if ! kill -0 "$lock_pid" 2>/dev/null; then
      echo "lock-order check failed: $label lock session exited before readiness"
      exit 1
    fi
    sleep 0.05
  done
  echo "lock-order check failed: $label lock session did not reach readiness"
  exit 1
}

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL
begin;
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
values ('$user_id', 'recurring-lock@example.test', now(), '{"provider":"google"}')
on conflict (id) do nothing;
insert into public.households (id, name, created_by)
values ('$household_id', 'Recurring lock household', '$user_id')
on conflict (id) do nothing;
delete from public.transactions
where id in ('$transaction_id', '$adapter_transaction_id')
   or recurring_schedule_id in ('$late_schedule_id', '$idempotency_schedule_id');
delete from public.recurring_transaction_schedule_events
where schedule_id in ('$schedule_id', '$adapter_schedule_id', '$late_schedule_id', '$idempotency_schedule_id');
delete from public.recurring_transaction_schedules
where id in ('$schedule_id', '$adapter_schedule_id', '$late_schedule_id', '$idempotency_schedule_id');
delete from public.subcategories
where id in ('$late_subcategory_id', '$idempotency_subcategory_id');
delete from public.categories
where id in ('$late_category_id', '$idempotency_category_id');
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
select set_config('joint.recurring_write', 'on', true);
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
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on, status
)
values (
  '$adapter_schedule_id', '$household_id', '$user_id', 'expense', 10, 'Adapter lock probe', '',
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  current_date - 7, 'weekly', 1, 1, current_date, 'active'
)
on conflict (id) do nothing;
insert into public.transactions (
  id, household_id, created_by, kind, amount, occurred_on, merchant, note,
  category_id, recurring_schedule_id, scheduled_for
)
values (
  '$adapter_transaction_id', '$household_id', '$user_id', 'expense', 10, current_date - 7,
  'Adapter lock probe', '',
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  '$adapter_schedule_id', current_date - 7
)
on conflict (id) do nothing;
insert into public.categories (id, household_id, name, kind, color)
values ('$late_category_id', '$household_id', 'Late destination probe', 'expense', '#ccebef')
on conflict (id) do nothing;
insert into public.subcategories (id, household_id, category_id, name)
values ('$late_subcategory_id', '$household_id', '$late_category_id', 'Late destination probe')
on conflict (id) do nothing;
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id, subcategory_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on, status
)
values (
  '$late_schedule_id', '$household_id', '$user_id', 'expense', 10, 'Late destination probe', '',
  null, '$late_subcategory_id', current_date, 'weekly', 1, 1, current_date, 'active'
)
on conflict (id) do nothing;
insert into public.categories (id, household_id, name, kind, color)
values ('$idempotency_category_id', '$household_id', 'Idempotency probe', 'expense', '#ccebef')
on conflict (id) do nothing;
insert into public.subcategories (id, household_id, category_id, name)
values ('$idempotency_subcategory_id', '$household_id', '$idempotency_category_id', 'Idempotency probe')
on conflict (id) do nothing;
insert into public.recurring_transaction_schedules (
  id, household_id, created_by, kind, amount, merchant, note, category_id, subcategory_id,
  anchor_date, cadence, interval_count, next_occurrence_index, next_occurs_on, status
)
values (
  '$idempotency_schedule_id', '$household_id', '$user_id', 'expense', 10, 'Idempotency probe', '',
  null, '$idempotency_subcategory_id', current_date, 'weekly', 1, 1, current_date + 7, 'active'
)
on conflict (id) do nothing;
select set_config('joint.recurring_write', 'off', true);
commit;
SQL

stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "begin; select id from public.recurring_transaction_schedules where id = '$schedule_id' for update; select pg_advisory_lock($ready_class_id, $ready_object_id); select pg_sleep(2); select pg_advisory_unlock($ready_class_id, $ready_object_id); commit;" \
  >"$lock_log" 2>&1 &
lock_pid=$!
wait_for_ready "$lock_pid" "$ready_object_id" "direct save"

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

stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "begin; select id from public.recurring_transaction_schedules where id = '$adapter_schedule_id' for update; update public.recurring_transaction_schedules set cadence = 'monthly', next_occurs_on = current_date where id = '$adapter_schedule_id'; select pg_advisory_lock($ready_class_id, $adapter_ready_object_id); select pg_sleep(2); select pg_advisory_unlock($ready_class_id, $adapter_ready_object_id); commit;" \
  >"$adapter_lock_log" 2>&1 &
adapter_lock_pid=$!
wait_for_ready "$adapter_lock_pid" "$adapter_ready_object_id" "adapter"

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL >"$adapter_save_log" 2>&1
set role authenticated;
set request.jwt.claim.sub = '$user_id';
select public.update_recurring_transaction_occurrence(
  '$adapter_transaction_id', 'future', 12, 'Adapter cadence saved', '', null,
  (select id from public.categories where household_id = '$household_id' and system_key = 'other_expense'),
  null, null, null
);
SQL
wait "$adapter_lock_pid"

adapter_cadence="$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
  "select cadence from public.recurring_transaction_schedules where id = '$adapter_schedule_id';")"
if [[ "$adapter_cadence" != "monthly" ]]; then
  echo "lock-order check failed: compatibility adapter overwrote the concurrent cadence with '$adapter_cadence'"
  cat "$adapter_lock_log" "$adapter_save_log"
  exit 1
fi

stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "begin; update public.categories set archived_at = now() where id = '$late_category_id'; select pg_advisory_lock($ready_class_id, $late_ready_object_id); select pg_sleep(2); select pg_advisory_unlock($ready_class_id, $late_ready_object_id); commit;" \
  >"$late_lock_log" 2>&1 &
late_lock_pid=$!
wait_for_ready "$late_lock_pid" "$late_ready_object_id" "late-destination"

stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL >"$late_processor_log" 2>&1 &
set role service_role;
select public.process_due_recurring_transaction_schedules(current_date);
SQL
late_processor_pid=$!

late_waiting=false
for _ in $(seq 1 100); do
  if [[ "$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
    "select exists (select 1 from pg_stat_activity where query like '%process_due_recurring_transaction_schedules%' and wait_event_type = 'Lock');")" == "t" ]]; then
    late_waiting=true
    break
  fi
  if ! kill -0 "$late_processor_pid" 2>/dev/null; then
    break
  fi
  sleep 0.05
done
if [[ "$late_waiting" != true ]]; then
  cat "$late_lock_log" "$late_processor_log"
  echo "lock-order check failed: processor did not wait on the concurrent destination invalidation"
  exit 1
fi
wait "$late_lock_pid"
wait "$late_processor_pid"

if ! grep -q 'blocked_count' "$late_processor_log"; then
  cat "$late_lock_log" "$late_processor_log"
  echo "lock-order check failed: late destination failure did not return processor counts"
  exit 1
fi
late_blocked_count="$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.recurring_transaction_schedule_events where schedule_id = '$late_schedule_id' and new_status = 'blocked';")"
late_occurrence_count="$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.transactions where recurring_schedule_id = '$late_schedule_id';")"
if [[ "$late_blocked_count" != 1 || "$late_occurrence_count" != 0 ]]; then
  cat "$late_lock_log" "$late_processor_log"
  echo "lock-order check failed: late destination rollback/block proof was not preserved"
  exit 1
fi

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "update public.recurring_transaction_schedules set next_occurs_on = current_date where id = '$idempotency_schedule_id';" \
  >/dev/null
stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL >"$idempotency_log_one" 2>&1 &
set role service_role;
select public.process_due_recurring_transaction_schedules(current_date);
SQL
idempotency_pid_one=$!
stdbuf -oL -eL "${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 <<SQL >"$idempotency_log_two" 2>&1 &
set role service_role;
select public.process_due_recurring_transaction_schedules(current_date);
SQL
idempotency_pid_two=$!
wait "$idempotency_pid_one"
wait "$idempotency_pid_two"
idempotency_occurrence_count="$("${psql_cmd[@]}" -X -At -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.transactions where recurring_schedule_id = '$idempotency_schedule_id';")"
if [[ "$idempotency_occurrence_count" != 1 ]]; then
  cat "$idempotency_log_one" "$idempotency_log_two"
  echo "lock-order check failed: concurrent processors created $idempotency_occurrence_count occurrences"
  exit 1
fi

"${psql_cmd[@]}" -X -v ON_ERROR_STOP=1 -c \
  "delete from public.transactions where id in ('$transaction_id', '$adapter_transaction_id') or recurring_schedule_id = '$idempotency_schedule_id'; delete from public.recurring_transaction_schedule_events where schedule_id in ('$schedule_id', '$adapter_schedule_id', '$late_schedule_id', '$idempotency_schedule_id'); delete from public.recurring_transaction_schedules where id in ('$schedule_id', '$adapter_schedule_id', '$late_schedule_id', '$idempotency_schedule_id'); delete from public.subcategories where id in ('$late_subcategory_id', '$idempotency_subcategory_id'); delete from public.categories where id in ('$late_category_id', '$idempotency_category_id');" \
  >/dev/null

echo "lock-order check passed: schedule-first save waited ${elapsed_seconds}s, adapter preserved monthly cadence, late failure blocked with rollback, and concurrent processors remained idempotent"
