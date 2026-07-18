# Task 18 report — load the household opening balance

## Status

Implemented. The dashboard loader now reads the shared household opening balance and no longer loads, maps, returns, or derives setup state from legacy accounts.

## Changes

- Replaced the `accounts` query with `households.select("opening_balance").eq("id", household.householdId).single()`.
- Kept the household, category, transaction, member, and claims reads in one `Promise.all`.
- Kept the existing generic `Unable to load household data.` error boundary, now including the household result.
- Passed `Number(householdResult.data.opening_balance)` to `buildMonthlyReport`.
- Removed the unused account-row mapper and the dashboard response's `accounts` and `setupRequired` fields.

The focused regression test already covered this exact behavior, so it required no change.

## Validation

- Red: `/Users/yonatan/.bun/bin/bun run test src/lib/dashboard-data.test.ts` failed before the change with `Dashboard loading must not query accounts.`
- Green: the same focused test passed after the change (1 test).
- Passed: `/Users/yonatan/.bun/bin/bunx eslint src/lib/dashboard-data.ts src/lib/dashboard-data.test.ts`.
- Passed: `git diff --check`.
- Repository-wide `bun run lint` remains blocked by pre-existing generated `.vercel/output` artifacts: 3,945 lint findings (101 errors, 3,844 warnings). No generated files were modified.

## Scope and concerns

Only `src/lib/dashboard-data.ts` and this report are Task 18 changes. Existing dirty Supabase temporary files and untracked plan files were preserved. No database, production, deployment, merge, or push action was performed.
