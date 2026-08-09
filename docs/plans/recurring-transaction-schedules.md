---
goal: Deliver recurring household transaction schedules with database-owned lifecycle controls
status: In progress
---

# Recurring Transaction Schedules

Recurring income and expense schedules create their first ledger entry immediately, then create idempotent future entries through the protected Vercel cron route. The immutable anchor determines weekly and monthly dates, including month-end clipping.

The remediation migration `20260809192843_harden_recurring_schedule_lifecycle.sql` moves every schedule mutation behind membership-checked RPCs, prevents direct authenticated DML, recalculates edited schedules only for future dates, pauses schedules when their destination is deleted, and preserves historical ledger rows. Duplicate confirmation may keep an existing first entry while creating future schedule occurrences without altering that row.

## Completion gate

- Apply the forward migration only through the approved `joint-dev` history → dry-run → apply → post-check workflow.
- Regenerate and compare database types after the hosted migration.
- Prove lifecycle, RLS, category deletion, and cron idempotency with hosted pgTAP before marking this plan complete.
