# Ledger capsules and controls

## Goal

Make the transaction ledger quicker to scan and manage without adding a second management surface or changing financial semantics.

## Data

- Keep the existing `categories.color` column, but assign new categories the next unused value from a fixed curated pastel palette rather than the single mint default. Existing values remain valid and editable.
- Add `household_members.color` as a non-null hex color, backfilled from the same palette deterministically by household membership order. A database `BEFORE INSERT` trigger assigns the next unused palette value to both new categories and new members when no color is supplied, so operator-provisioned and sign-in-created memberships behave the same way.
- Colors are household-shared data. Category and member edits use authenticated Server Actions and existing household RLS.
- No arbitrary color picker. The curated palette preserves contrast and keeps the visual language restrained.

## Ledger

- Replace plain Type, Paid by, and Category cells with compact labelled capsules.
- Type remains semantic: income uses positive green and expense uses negative red. Neither is customizable.
- Paid by and Category use their stored pastel; unassigned and uncategorized use neutral gray. Labels remain visible, so color is never the sole cue.
- Do not append `(Imported)` to the note column.
- One icon-only gear button in the ledger card header opens a `Popover` with sort, filter, and row-selection controls. It has an accessible name and tooltip.
- Sort supports date and amount, ascending or descending. Filters support one or more types, members, and categories. Filter and sort state are encoded in the ledger URL query string.
- Selection mode adds a leading checkbox column. Checked rows reveal a compact `Delete selected` action. The action opens an `AlertDialog` naming the selected count before calling a scoped bulk-delete Server Action.

## Settings

- The existing category edit sheet gains the curated palette control.
- Settings gains one `Member colors` row with a compact control for each current household member. It edits the shared member color, not a browser preference.

## Errors and testing

- A failed color save retains the previous color and shows inline feedback.
- A failed bulk delete leaves selections and rows intact and reports an accessible error.
- Test color assignment/backfill, scoped color edits, URL sort/filter behavior, selection-mode keyboard access, and bulk-delete authorization/confirmation.

## Scope

No custom color picker, saved filter presets, column configuration, pagination, exports, or changes to transaction amounts, categories, or authorization rules.
