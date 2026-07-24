# Financial Model

## Purpose

Joint has one signed shared balance per household. This record defines the implemented data model, accounting invariants, reporting behavior, and the migration that established it.

## Ownership and authorization

```text
household
  ├─ household_members
  ├─ categories
  └─ transactions
```

`household_members` is the household-data authorization boundary. RLS is enabled on household-owned records; application mutations derive the household and user from verified server-side identity rather than browser input.

## Data model and invariants

| Record | Implemented purpose |
| --- | --- |
| `households` | Shared container with a signed `opening_balance`. |
| `household_members` | Household membership and `owner` or `member` role. |
| `categories` | Household-owned `income` or `expense` categories with archival state. |
| `member_cards` | Optional household-scoped mapping of a member to one card's last four digits. |
| `transactions` | Positive ILS amount, date, `income` or `expense` direction, creator, optional payer/category, source, merchant, and optional note. |

- The opening balance may be positive, zero, or negative.
- Transaction amounts are positive ILS values with at most two decimal places; direction comes only from `kind`.
- Manual transactions require a category from the same household with the same kind. Statement imports may be uncategorized; the data model permits their category to be set, changed, or cleared without weakening the manual-entry invariant.
- A non-null `paid_by` must identify a member of the same household. Imported transactions may be unassigned when their card has no household mapping.
- Imported transactions retain their `statement_import` source, merchant, SHA-256 file hash, and source-row number. The hash and row number prevent retrying identical source bytes from duplicating rows within a household; source files are not stored.
- Browser input never selects household ownership, transaction creator, or membership role.

## Balance and reporting

```text
shared balance = opening balance + income - expenses
```

For a selected `YYYY-MM` month, the shared balance includes transactions before the first day of the next month. Income, expense, and expense-category totals include all selected-month transactions for past months; for the current month, they stop at `asOfDate` (today by default). Current-month comparisons use activity through that same day-of-month against the prior three months. Expected monthly income averages prior lookback months that contain income. Recent activity sorts by `occurred_on`, then `created_at`, descending.

`src/lib/dashboard-data.ts` loads the household opening balance, categories, transactions, and members. `src/lib/financial-report.ts` applies the formula as the pure reporting layer. Uncategorized imports are included in shared-balance, income, expense, comparison, and recent-activity calculations but omitted from category totals. `src/app/actions/transactions.ts` persists manual edits after server-side membership, payer, and category checks; `src/app/actions/statement-import.ts` performs authenticated, atomic statement imports.

## Shared-balance migration

`20260717210731_align_shared_balance.sql` converted the legacy schema in one transaction. It locks the affected tables, rejects archived accounts, adds `households.opening_balance`, and backfills it from signed legacy opening balances. It deletes no-longer-supported transaction rows, narrows transaction kinds to `income` and `expense`, requires a category, installs category-link validation, and removes obsolete schema. Final checks reject a missing opening balance or an invalid category relationship before commit.

`20260721183411_add_statement_import.sql` added authenticated CSV/XLSX statement imports, `member_cards`, nullable imported categories and payers, source metadata, and duplicate-import protection. The original manual-entry category invariant remains intact.

## Primary verification

- `src/lib/financial-report.test.ts`
- `src/lib/dashboard-data.test.ts`
- `src/app/actions/transactions.test.ts`
- `supabase/tests/shared_balance.sql`
- `supabase/tests/two_layer_access.sql`

## Non-goals

- No double-entry ledger, bank connection, financial credential, attachment, budget, recurring transaction, automatic categorization, or audit-history model is implemented. CSV/XLSX statement import is supported, but source files and full card details are never stored.
- The directional roadmap does not change these invariants.
