# Recurring Transactions

This document records the approved recurring-transaction lifecycle contract for
the remediation work. The migration and runtime changes described here are
planned; this document does not claim that they are already deployed.

Recurring schedules are household-owned templates for manually created income
or expense transactions. PostgreSQL owns recurrence dates, occurrence
identity, and lifecycle state. Authenticated Server Actions are the member
entry point for mutations, while Vercel Cron is only an authenticated trigger
for the database processor. Existing category, payer, Bills-period,
shared-balance, RLS, and positive-ILS constraints remain authoritative.

## Occurrence identity and dates

- A regular manual income or expense converted to recurring becomes occurrence
  zero. Its `scheduled_for` is its existing `occurred_on`, and the schedule's
  `next_occurs_on` is the following cadence occurrence. Conversion reuses the
  recurring edit form fields and one `Save changes` submission (REQ-001,
  REQ-007).
- Every occurrence, including occurrence zero, uses
  `transactions.recurring_schedule_id` and `transactions.scheduled_for` as
  its canonical identity. The unique occurrence key remains
  `(recurring_schedule_id, scheduled_for)`. The legacy
  `first_occurrence_transaction_id` is backfilled and verified, then removed
  (REQ-002).
- PostgreSQL calculates recurrence dates from an immutable anchor using UTC
  ISO dates. Weekly and monthly cadence calculations retain month-end clipping
  without drifting. Posting dates are stored in `occurred_on`; scheduled dates
  are stored in `scheduled_for`.

## Atomic mutations

Recurring occurrence edits and cadence/template updates commit in one database
transaction. Every mutation locks the schedule row first, then the linked
occurrence rows, so all paths use schedule-first lock ordering (REQ-005).

The existing scope contract is preserved (REQ-006):

- `this` may change the selected row, including its kind and posting date.
- `future` changes only the template for ungenerated rows.
- `all` changes the template and linked rows while preserving every existing
  row's posting and scheduled dates.

Conversion, recurring edits, and regular edits use the existing transaction
sheet and one primary save submission; no sequential schedule-plus-row write
may expose an intermediate state.

## Lifecycle and history

Schedules have exactly four lifecycle statuses: `active`, `paused`, `stopped`,
and `blocked`. `stopped` is terminal. `blocked` is reserved for processor or
destination failures; repairing a destination does not resume a schedule
automatically. Historical schedules and occurrences remain linked and
queryable after stopping (REQ-003).

Every lifecycle transition records the schedule, household, previous status,
new status, reason, actor when available, and timestamp in lifecycle history
(`recurring_transaction_schedule_events`) (REQ-004). Member status changes and
processor-owned failure transitions use the same event shape.

## Due processing and compatibility

The existing daily Vercel schedule, `0 3 * * *`, remains in place. Its route
authenticates with `CRON_SECRET` and invokes PostgreSQL; it does not own dates,
lifecycle, or catch-up decisions. The database processor keeps the unique
occurrence key, acquires schedules with `FOR UPDATE SKIP LOCKED`, and retains
the 366-occurrence catch-up cap.

Due processing returns exact integer `created_count` and `blocked_count`
results. Classified destination failures block the schedule and contribute to
`blocked_count`; unexpected failures are surfaced by the cron adapter as HTTP 500. The unique key and row locking make overlapping or duplicate cron calls
idempotent (REQ-008).

For one release, legacy `enabled` reads and legacy lifecycle RPC names
`set_recurring_transaction_schedule_enabled` and
`delete_recurring_transaction_schedule` remain compatibility adapters because
production migrations run before application deployment. The enabled adapter
reflects whether status is `active`; legacy status-management names delegate to
the new status transitions. The delete adapter transitions the schedule to
`stopped` and never deletes the schedule or its occurrences. These adapters are
removed only after the compatibility release.

No queue, retry service, `pg_cron`, or second scheduler is introduced. The
existing authenticated cron trigger and PostgreSQL processor remain the sole
scheduling path.
