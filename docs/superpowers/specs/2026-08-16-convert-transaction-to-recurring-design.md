# Convert an existing transaction to recurring

## Goal

Let a member turn an existing manual income or expense transaction into a recurring schedule without creating a duplicate ledger entry.

## UI

When editing a transaction that has no recurring schedule, show the existing **Recurring schedule** form used by recurring transaction edits. It includes the same repeat cadence selector and custom interval controls. It does not show pause or stop actions until the transaction has a schedule.

The sheet keeps one Save changes button. A selected transaction remains the first occurrence; the next scheduled occurrence is calculated after its posting date.

## Data flow

Save sends the edited transaction values and selected cadence through the existing authenticated schedule-creation path for an existing transaction. The schedule copies amount, kind, date, merchant, note, payer, category/subcategory, and billing period from the submitted form. The current row becomes the schedule's first occurrence; no second transaction is inserted.

Existing recurring transaction editing, pausing, stopping, and scope behavior remain unchanged. No database migration is required.

## Errors and verification

If schedule creation fails, preserve the existing transaction and show the existing save error. Add focused action and sheet tests proving both income and expense conversion, preservation of submitted values, no duplicate row path, and the existing recurring controls' unchanged behavior. Verify the edit sheet in the authenticated browser.
