# Task 20 report — consume one-balance UI data

## Status

Implemented. The dashboard no longer reads the retired `accounts` or `setupRequired` response fields, so it consumes the Task 18 dashboard contract without a runtime error.

## Changes

- Removed the setup-required branch and legacy account-name map from `src/app/(app)/page.tsx`.
- Kept the existing dashboard cards, comparison text, accessibility labels, and activity layout; recent activity now renders its transaction category directly.
- Removed the ledger's no-category fallback, matching the income/expense-only transaction invariant.
- Added focused regression assertions for the narrowed dashboard response and direct category rendering. `transaction-sheet.tsx` already consumed the narrowed income/expense type without a compatibility branch, so it was intentionally unchanged.

## Validation

- Red: `/Users/yonatan/.bun/bin/bun run test 'src/app/(app)/page.test.tsx' src/components/transaction-ledger.test.tsx src/components/transaction-sheet.test.tsx` failed before the production edit: the page attempted `data.accounts.map`, and the ledger retained the no-category compatibility branch.
- Green: the same focused command passed 7/7 after the edit.
- Passed: `/Users/yonatan/.bun/bin/bun run lint -- 'src/app/(app)/page.tsx' 'src/app/(app)/page.test.tsx' src/components/transaction-ledger.tsx src/components/transaction-ledger.test.tsx src/components/transaction-sheet.tsx src/components/transaction-sheet.test.tsx`.
- Passed: `git diff --check`.
- Repository-wide `bun run lint` remains blocked by pre-existing generated `.vercel/output` artifacts: 3,945 findings (101 errors, 3,844 warnings). No generated files were modified.

## Scope and concern

Only the dashboard page, ledger, their focused tests, and this report are Task 20 changes. Existing dirty Supabase temporary files and untracked plan files were preserved. No database, production, deployment, merge, or push action was performed.

`ReportTransaction.categoryId` remains nullable in generated database types because the schema uses a constraint/trigger rather than a `NOT NULL` column; the UI uses the established database invariant with a non-null assertion and no compatibility fallback.
