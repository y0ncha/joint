# Recurring Expenses — Roadmap Brief

## Purpose

Reduce repetitive manual entry for predictable shared costs while keeping every recorded expense reviewable and preventing silent balance changes.

## Product shape

- Members create reusable recurring-expense rules: name, amount, expense category, paid-by member, frequency, next due date, and optional end date.
- A dedicated review queue shows upcoming and overdue instances. A member confirms, edits, skips, or pauses each occurrence before it becomes a normal transaction.
- Show the next expected charge on the dashboard or Bills tab only after the product has a clear upcoming-items surface.
- Start with fixed-amount weekly and monthly rules. Exclude variable bills, income, transfers, auto-posting, complex proration, and automatic card/bank reconciliation.

## Rules and decisions

- A recurrence rule is not a financial transaction. Only a confirmed occurrence creates a positive expense transaction and affects balance/reporting.
- Confirming an occurrence must be idempotent: one rule occurrence may create at most one linked transaction, even across retries or two open tabs.
- Editing a rule affects future unconfirmed occurrences only. Historical transactions retain their original values and category.
- Skipping an occurrence records the decision so it is not offered repeatedly; pausing leaves historical data intact.

## Technical direction

- Add household-scoped recurrence rules and occurrence state in new ordered migrations with RLS. Link a confirmed transaction to an immutable recurrence occurrence.
- Use a pure schedule generator that accepts a rule and date range. Avoid a background job until scale demands it; calculate/reconcile due instances during authenticated reads/actions.
- Enforce category kind, positive two-decimal ILS amounts, member ownership, allowed frequencies, and valid start/end dates through shared validation plus database constraints.
- Keep mutation paths as authenticated Server Actions; never accept household/user IDs from the browser. Regenerate Supabase types after the migration.

## Validation and acceptance

- Unit-test month-end, leap-year, skipped, paused, end-date, and daylight-saving-insensitive date scheduling.
- Test confirm/retry/concurrent-confirm behaviour and that one occurrence cannot double-post.
- Test RLS isolation, rule edits preserving history, and all accessible queue states.

## Dependencies and rollout

Requires live expense categories, authenticated transaction actions, and the transaction ledger. Bills analysis may consume recurrence occurrences, but a recurring rule should not be presented as a bill unless the user explicitly marks it as one in a later product decision.

