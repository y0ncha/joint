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
| `transactions` | Positive ILS amount, date, `income` or `expense` direction, matching category, creator, payer, and optional note. |

- The opening balance may be positive, zero, or negative.
- Transaction amounts are positive ILS values with at most two decimal places; direction comes only from `kind`.
- A transaction requires a category from the same household with the same kind, enforced by a database trigger.
- `paid_by` must identify a member of the same household.
- Browser input never selects household ownership, transaction creator, or membership role.

## Balance and reporting

```text
shared balance = opening balance + income - expenses
```

For a selected `YYYY-MM` month, the shared balance includes transactions before the first day of the next month. Income, expense, and expense-category totals include all selected-month transactions for past months; for the current month, they stop at `asOfDate` (today by default). Current-month comparisons use activity through that same day-of-month against the prior three months. Expected monthly income averages prior lookback months that contain income. Recent activity sorts by `occurred_on`, then `created_at`, descending.

`src/lib/dashboard-data.ts` loads the household opening balance, categories, transactions, and members. `src/lib/financial-report.ts` applies the formula as the pure reporting layer. `src/app/actions/transactions.ts` persists only the two supported transaction directions after server-side membership and payer checks.

## Shared-balance migration

`20260717210731_align_shared_balance.sql` converted the legacy schema in one transaction. It locks the affected tables, rejects archived accounts, adds `households.opening_balance`, and backfills it from signed legacy opening balances. It deletes no-longer-supported transaction rows, narrows transaction kinds to `income` and `expense`, requires a category, installs category-link validation, and removes obsolete schema. Final checks reject a missing opening balance or an invalid category relationship before commit.

## Primary verification

- `src/lib/financial-report.test.ts`
- `src/lib/dashboard-data.test.ts`
- `src/app/actions/transactions.test.ts`
- `supabase/tests/shared_balance.sql`
- `supabase/tests/two_layer_access.sql`

## Non-goals

- No double-entry ledger, bank import, statement ingestion, financial credential, attachment, budget, recurring transaction, or audit-history model is implemented.
- Roadmap briefs under `docs/plans/features/` do not change these invariants.
