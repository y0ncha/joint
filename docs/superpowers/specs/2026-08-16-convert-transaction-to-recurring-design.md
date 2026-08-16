# Convert an existing transaction to recurring

## Status

This is a planned design contract. The forward migration, RPC, Server Action,
and transaction-sheet behavior described here are not claimed to be deployed.

## Goal

Let a member turn an existing regular manual income or expense transaction
into a recurring schedule without creating a duplicate ledger entry.

## Scope

- Conversion applies to existing regular manual income and expense
  transactions. Statement-import rows are not convertible.
- The selected transaction is updated and attached atomically by
  `public.convert_transaction_to_recurring_schedule(...) returns uuid`.
- The browser never chooses household or actor identity. The authenticated
  Server Action supplies the transaction ID and validated form fields.

## UI

When editing a regular manual transaction that has no recurring schedule, show
the existing **Recurring schedule** form used by recurring transaction edits.
It reuses the existing recurring cadence/interval template and custom interval
controls. It does not show pause or stop actions until the transaction has a
schedule.

The sheet keeps one bottom **Save changes** action. A selected transaction
becomes occurrence zero; its next scheduled occurrence is calculated from the
following cadence after its current posting date. Conversion does not require
a second schedule save. Existing recurring transaction editing, pausing,
stopping, and scope behavior remain unchanged.

## Atomic conversion

The authenticated Server Action validates the submitted transaction and
recurring template fields, derives the household and actor from the session,
and calls the conversion RPC with the selected transaction ID. The RPC:

1. Locks and validates one unlinked manual household transaction.
2. Validates the submitted transaction and template fields.
3. Inserts one `active` schedule.
4. Updates the selected row and attaches it to the schedule as occurrence zero.
5. Commits all changes together, or commits none of them.

The schedule copies the submitted amount, kind, posting date, merchant, note,
payer, category/subcategory, and billing period. The selected row remains the
existing ledger row; conversion never inserts a second row.

## Canonical lineage and dates

The selected row becomes occurrence zero with
`scheduled_for = occurred_on`. The schedule's `next_occurs_on` is the
following cadence occurrence after that anchor. This applies to both income
and expense conversion.

Every occurrence uses `transactions.recurring_schedule_id` plus
`transactions.scheduled_for`; the legacy
`first_occurrence_transaction_id` path is backfilled, verified, and removed by
a forward migration. The unique occurrence key remains
`(recurring_schedule_id, scheduled_for)`.

The migration and conversion preserve the recurring architecture's immutable
cadence anchor, UTC ISO date calculation, month-end clipping, manual source,
household ownership, category and payer validation, Bills-period validation,
and positive-ILS transaction invariants. They do not claim that the migration
or runtime behavior is already deployed.

## Duplicate creation

When duplicate creation preserves an existing matching regular row, it uses
the same canonical conversion behavior: update and attach that existing row as
occurrence zero through the atomic conversion path. It must not create a
second ledger row or a parallel first-occurrence lineage.

## Errors and verification

If any validation or write in conversion fails, the RPC rolls back the
transaction and the existing row remains unchanged; the Server Action shows
the existing save error. Focused action and sheet tests should prove regular
expense and income conversion, submitted-value preservation, occurrence-zero
identity, the single RPC/no-duplicate-row path, rejection of statement-import
rows and already-linked rows, and unchanged recurring controls and scope
behavior. Verify the edit sheet in the authenticated browser on desktop and
mobile; treat that browser proof separately from local and hosted database
proof.
