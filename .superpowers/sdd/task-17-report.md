# Task 17 report — one shared balance

## Scope completed

- Removed the legacy account mapper and account identifiers from mapped transactions in `src/lib/finance-types.ts`.
- Removed account, per-account balance, credit-card debt, and transfer reporting from `src/lib/financial-report.ts`.
- `buildMonthlyReport` now accepts `openingBalance` and returns `sharedBalance`; it applies income and expenses before the selected month's exclusive end date.
- Preserved monthly transaction cutoff/order, partial-month comparisons, expected-income calculation, category fallback/sorting, and current-period income/expense totals.

## Tests

- Red: `bun run test src/lib/financial-report.test.ts` failed all 7 target tests because the legacy implementation required `accounts`.
- Green: the same focused command passed 7/7 after the report change.
- `bunx tsc --noEmit` remains blocked outside this task's scope by unmodified account consumers in `dashboard-data.ts`, `transactions.ts`, and the dashboard page, plus a stale `.next/types` reference. The generated database types already omit `accounts`, so these errors existed at the contract boundary this task removes.

## Scope protection

- Did not modify dashboard, actions, UI, database schema, deployment files, or unrelated working-tree changes.
- No test changes were needed: the existing focused test already represented the target input/output contract.
