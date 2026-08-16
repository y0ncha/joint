# Final review fix wave report

Date: 2026-08-16
Scope: `SEC-001`, standalone recurring schedule-update RPC removal, and blocked-schedule stop control.
Commit SHA: pending final commit

## Files changed

- `supabase/migrations/20260816190755_recurring_lifecycle_final_review_fixes.sql`
  - Drops the browser-owned `target_household_id` overloads for recurring schedule creation.
  - Recreates both public creation entry points with household identity derived from the authenticated membership.
  - Drops `public.update_recurring_transaction_schedule(...)`.
  - Grants the new creation signatures only to `authenticated` after revoking `public` and `anon`.
- `supabase/tests/recurring_schedule_security.sql`
  - Adds signature, authenticated-creation, and removed-RPC behavior assertions.
  - Updates creation calls to the ownership-safe signatures.
- `src/app/actions/transactions.ts`
  - Stops sending `target_household_id` to recurring creation RPCs.
- `src/lib/database.types.ts`
  - Removes the ownership argument from both creation RPC types and removes the deleted update RPC type.
- `src/components/transaction-sheet.tsx`
  - Reuses the existing confirmed stop control for `blocked` schedules.
- `src/components/transaction-sheet.test.tsx`
  - Requires the blocked status to expose stop and resume, while stopped remains terminal.

## TDD evidence

The focused UI test was changed first and run before the implementation:

```text
bunx vitest run src/components/transaction-sheet.test.tsx
1 failed, 29 passed (blocked lifecycle controls omitted Stop future repeats)
```

The focused rollback-wrapped database test was also changed before the migration. After verifying `supabase/.temp/project-ref` was `magcvzqnwrwxkhtsfspg`, the red run was:

```text
SUPABASE_TELEMETRY_DISABLED=1 supabase test db --db-url "$JOINT_DEV_TEST_DB_URL" supabase/tests/recurring_schedule_security.sql
Failed 4/84 subtests
Failed test 10: standalone recurring schedule update RPC remained callable
Failed tests 36-38: ownership-safe creation signatures were absent and no-argument creation failed
```

After the implementation, local focused checks were green:

```text
bunx vitest run src/components/transaction-sheet.test.tsx src/app/actions/transactions.test.ts src/app/actions/recurring-transactions.test.ts
Test Files 3 passed; Tests 77 passed

bun run typecheck
tsc --noEmit: passed

bunx prettier --check src/app/actions/transactions.ts src/components/transaction-sheet.tsx src/components/transaction-sheet.test.tsx src/lib/database.types.ts
All matched files use Prettier code style

git diff --check
passed
```

## Linked project preflight and migration history

- Preflight passed: `supabase/.temp/project-ref` was exactly `magcvzqnwrwxkhtsfspg` (`joint-dev`).
- `supabase migration list --linked` completed successfully. Remote history was aligned through `20260816183738`; only `20260816190755` was local and pending.
- `supabase db push --linked --dry-run` completed successfully and listed only `20260816190755_recurring_lifecycle_final_review_fixes.sql`.
- The required `supabase db push --linked` was attempted with the same project-ref preflight, but the approval gate rejected the persistent shared `joint-dev` schema write because this transcript had no explicit user approval for the push.
- No linked migration was applied, no production project was touched, and no credentials were printed.

## Concerns

The hosted post-migration pgTAP green run and post-push migration-list confirmation are pending explicit approval for the `joint-dev` schema write. The generated database types were updated to the reviewed contract locally; authoritative linked regeneration should be run immediately after the migration is approved and applied.
