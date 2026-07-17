# Financial Model

## Purpose

This document defines the implemented household-finance data model, accounting invariants, and reporting behavior. It distinguishes the visible one-balance MVP from future-ready schema support.

## Ownership boundary

A household is the ownership boundary for financial records:

```text
household
  ├─ household_members
  ├─ accounts
  ├─ categories
  └─ transactions
```

Every household-owned table uses RLS. Application mutations derive the household and user from verified server-side identity rather than accepting those identifiers from the browser.

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | Application profile corresponding to a Supabase Auth user. |
| `households` | Shared household container created by the owner. |
| `household_members` | User-to-household membership and `owner` or `member` role. |
| `accounts` | Opening balance and account metadata used by transaction and reporting logic. |
| `categories` | Household-owned `income` or `expense` categories with archival state. |
| `transactions` | Positive amount, date, kind, account, optional destination, category, creator, payer, and note. |

The schema supports `bank` and `credit_card` accounts and retains a `transfer` transaction kind. The visible MVP transaction flow accepts only income and expense and selects the active shared bank account on the server.

The current codebase still contains a directly addressable `/accounts` management route, but it is excluded from primary `WorkspaceShell` navigation and from the visible MVP design contract. Treat that route as retained foundation, not authorization to expand the product surface.

## Financial invariants

- Transaction amounts are positive ILS values with at most two decimal places.
- Transaction `kind` determines direction; a negative stored amount is invalid.
- Income requires an income category and increases a bank balance.
- Expense requires an expense category. It decreases a bank balance or increases credit-card debt in the underlying reporting model.
- A transfer has no category, moves value from a bank account to a credit-card account, reduces bank balance and card debt, and never contributes to income, expense, or category totals.
- `paid_by` must identify a member of the same household.
- Archived accounts and categories remain available for historical reporting but are excluded from new-entry choices.
- Browser input never selects household ownership, transaction creator, or membership role.

## Visible MVP contract

The visible MVP intentionally narrows the underlying model:

- One internal shared bank account represents the household balance.
- Transaction entry exposes income and expense only.
- Users choose a category, date, payer, amount, and optional note.
- The server selects the internal shared account.
- Account management, card debt, and transfers are not primary navigation or transaction-entry concepts.

Schema support for future capabilities does not make those capabilities part of the MVP.

## Balance calculation

For a selected month, balances include transactions occurring before the first day of the following month.

```text
bank balance
  = opening bank balances
  + bank income
  - bank expenses
  - transfers out

card debt
  = opening card balances
  + card expenses
  - transfers received
```

The dashboard's visible reporting is based on the shared-balance model. Card debt remains an internal reporting field until an approved design exposes it.

## Monthly reporting

The selected month is represented as `YYYY-MM`.

- Income and expense totals include transactions inside the selected month.
- For the current month, comparisons use activity through today's day-of-month against the same partial period in the prior three months.
- Expected monthly income is the average of prior months that contain recorded income within the three-month lookback.
- Category totals include expense transactions only and sort by amount descending, then category name.
- Recent activity sorts by `occurred_on` descending and then `created_at` descending.
- Transfers are excluded from income, expense, and category totals.
- Archived categories retain their historical amounts and use a fallback label if their current category record is unavailable.

## Validation and persistence

- `src/lib/validation.ts` is the current form-validation boundary for accounts, categories, partner email, and visible transaction shapes.
- `src/app/actions/transactions.ts` resolves the shared bank account and verifies that `paid_by` belongs to the household before mutation.
- `src/lib/finance-types.ts` maps generated Supabase rows into domain values.
- `src/lib/financial-report.ts` is the pure reference implementation for monthly reporting.
- `src/lib/account-balances.ts` preserves the broader bank, credit-card, and transfer invariants.
- `src/lib/database.types.ts` is generated from the applied Supabase schema and must not be edited by hand.

## Primary verification

- `src/lib/validation.test.ts`
- `src/lib/financial-report.test.ts`
- `src/lib/account-balances.test.ts`
- `src/app/actions/transactions.test.ts`
- `supabase/tests/`

## Non-goals

- No double-entry ledger is introduced for the MVP.
- No bank import, statement ingestion, card credential, attachment, budget, recurring transaction, or audit-history model is implied.
- Roadmap briefs under `docs/plans/features/` do not change these invariants.
