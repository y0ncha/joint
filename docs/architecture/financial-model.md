# Financial Model

## Purpose

Joint has one signed shared balance per household. This record defines the implemented data model, accounting invariants, reporting behavior, and the migration that established it.

## Ownership and authorization

```text
household
  ├─ household_members
  ├─ categories
  │   └─ subcategories
  └─ transactions
```

`household_members` is the household-data authorization boundary. RLS is enabled on household-owned records; application mutations derive the household and user from verified server-side identity rather than browser input.

## Data model and invariants

| Record              | Implemented purpose                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `households`        | Shared container with a signed `opening_balance` and optional shared Groceries monthly threshold.                                                                             |
| `household_members` | Household membership and `owner` or `member` role.                                                                                                                            |
| `categories`        | Household-owned `income` or `expense` parent categories with a registered family color and icon.                                                                              |
| `subcategories`     | Household-owned children with a persisted color from the parent category's database family palette and an optional icon override.                                             |
| `member_cards`      | Optional household-scoped mapping of a member to one card's last four digits.                                                                                                 |
| `transactions`      | Positive ILS amount, date, `income` or `expense` direction, creator, optional payer and `subcategory_id`, source, merchant, optional note, and optional Bills service period. |

- The opening balance may be positive, zero, or negative.
- Transaction amounts are positive ILS values with at most two decimal places; direction comes only from `kind`.
- New manual transactions require a matching subcategory from the same household and kind. Statement imports may be uncategorized. Deleting a category deletes its subcategories and clears linked transaction subcategory references, preserving those transactions as uncategorized history.
- A subcategory has no kind of its own; its kind is derived from its parent category.
- Categories use registered family colors. Each subcategory persists one color from its parent's database family palette. A subcategory icon overrides its parent icon; otherwise read models use the parent icon.
- A non-null `paid_by` must identify a member of the same household. Imported transactions may be unassigned when their card has no household mapping.
- Imported transactions retain their `statement_import` source, merchant, SHA-256 file hash, and source-row number. The hash and row number prevent retrying identical source bytes from duplicating rows within a household; source files are not stored.
- Browser input never selects household ownership, transaction creator, or membership role.

## Balance and reporting

```text
shared balance = opening balance + income - expenses
```

For a selected `YYYY-MM` month, the shared balance includes transactions before the first day of the next month. Income, expense, and expense-category totals include all selected-month transactions for past months; for the current month, they stop at `asOfDate` (today by default). Current-month comparisons use activity through that same day-of-month against the prior three months. Expected monthly income averages prior lookback months that contain income. Recent activity sorts by `occurred_on`, then `created_at`, descending.

`src/lib/dashboard-data.ts` loads the household opening balance, categories, subcategories, transactions, and members. It projects each child with its parent category and resolves the effective icon as the child's override or the parent icon. Ledger category filtering remains parent-scoped by mapping each assigned transaction's subcategory to its parent category ID. `src/lib/financial-report.ts` applies the formula as the pure reporting layer and likewise rolls assigned expense totals up through `transactions.subcategory_id` to the parent category. Assigned transaction labels resolve as `Category → Subcategory`.

Uncategorized statement imports and historical transactions orphaned by category or subcategory deletion remain valid and are included in shared-balance, income, expense, comparison, and recent-activity calculations, but omitted from parent-category totals. They render as `Uncategorized`. `src/app/actions/transactions.ts` persists manual edits after server-side membership, payer, and active matching-kind subcategory checks; `src/app/actions/statement-import.ts` performs authenticated, atomic statement imports.

## Bills & Groceries subset

Bills & Groceries is an implemented, narrow analytics subset, not a generalized budget or obligations model. Each household has protected `Bills` and `Groceries` expense categories identified by stable system keys. Groceries has exactly the protected `Main run` and `Top-ups` children; Bills may have household-managed children.

Only Bills transactions may have an optional inclusive `service_period_start` and `service_period_end`. Those dates are used solely to prorate the transaction's stored amount for Bills analytics; they never change the ledger row, `occurred_on` posting date, stored amount, or shared-balance calculation. `households.groceries_monthly_budget` is one optional shared monthly Groceries threshold, not a general budget facility. [`bills-groceries-analytics.md`](bills-groceries-analytics.md) records the complete analytics mechanism.

## Shared-balance migration

`20260717210731_align_shared_balance.sql` converted the legacy schema in one transaction. It locks the affected tables, rejects archived accounts, adds `households.opening_balance`, and backfills it from signed legacy opening balances. It deletes no-longer-supported transaction rows, narrows transaction kinds to `income` and `expense`, required a legacy category at that stage, installed category-link validation, and removed obsolete schema. Final checks rejected a missing opening balance or an invalid category relationship before commit.

`20260721183411_add_statement_import.sql` added authenticated CSV/XLSX statement imports, `member_cards`, nullable imported categories and payers, source metadata, and duplicate-import protection. The original manual-entry category invariant remains intact.

`20260725223804_category_subcategory_hierarchy.sql` replaced direct category assignment with household-scoped `subcategories` and `transactions.subcategory_id`. Later grouped-color and icon migrations constrained categories to registered families, persisted each child's database-validated family color, and added optional child icon overrides. `20260726130058_category_deletion_uncategorizes_transactions.sql` made category or subcategory deletion preserve transaction history by setting the linked `subcategory_id` to null.

`20260730125519_essentials_dashboard.sql` added the protected Bills/Groceries taxonomy, optional Bills service-period columns, and the optional shared Groceries monthly threshold. Its constraints keep periods paired, inclusive, ordered, and limited to Bills transactions while preserving stored ledger values and posting dates.

## Primary verification

- `src/lib/financial-report.test.ts`
- `src/lib/dashboard-data.test.ts`
- `src/app/actions/transactions.test.ts`
- `src/components/transaction-ledger.test.tsx`
- `src/app/(app)/page.test.tsx`
- `supabase/tests/shared_balance.sql`
- `supabase/tests/two_layer_access.sql`

## Non-goals

- No double-entry ledger, bank connection, financial credential, attachment, generalized budget, recurring transaction, manually maintained obligation, upcoming/overdue state, expected-versus-recorded analysis, automatic categorization, or audit-history model is implemented. CSV/XLSX statement import is supported, but source files and full card details are never stored.
- The directional roadmap does not change these invariants.
