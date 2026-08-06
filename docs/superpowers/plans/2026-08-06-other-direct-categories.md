# Other Direct Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two protected grey `Other` categories that accept direct, kind-matched manual transactions while preserving the subcategory-only model everywhere else.

**Architecture:** Reintroduce `transactions.category_id` only as a nullable, household-scoped direct reference. A replacement transaction trigger permits that reference exclusively for `other_income` and `other_expense`; all other direct assignments remain invalid. Read models expose a normalized category-or-subcategory selection so UI and reports never fabricate a hidden child.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest, Supabase/Postgres, pgTAP, Bun.

## Global Constraints

- System keys are `other_income` and `other_expense`; their stored and displayed name is `Other`, their color is `#d5d5c4`, and each uses an existing neutral icon.
- Existing user-created categories remain subcategory-only; a manual transaction has exactly one valid assignment, while an import may have zero or one.
- Direct assignment is valid only for an active Other category in the transaction's household and with its matching kind.
- Do not migrate uncategorized historical transactions or imports into Other.
- Do not run `bun run build`, create/switch branches, push, migrate hosted Supabase, or commit without explicit user authorization.
- Preserve existing dirty changes in `src/components/category-form*` and `src/components/category-list*`; integrate only after inspecting them immediately before editing.

## Files and Responsibilities

| File                                                                                   | Responsibility                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `supabase/migrations/20260806172545_add_other_direct_categories.sql`                   | Persist, seed, protect, and validate the two direct Other categories.     |
| `supabase/tests/shared_balance.sql`                                                    | Prove database-level assignment and identity invariants.                  |
| `src/lib/database.types.ts`                                                            | Regenerated database contract after the migration.                        |
| `src/lib/finance-types.ts`, `src/lib/dashboard-data.ts`, `src/lib/financial-report.ts` | Normalize direct category and subcategory read models and report rollups. |
| `src/app/actions/transactions.ts`, `src/lib/validation.ts`                             | Validate and persist one assignment path.                                 |
| `src/components/transaction-sheet.tsx`                                                 | Offer kind-matched grey Other alongside subcategories.                    |
| `src/components/category-list.tsx`                                                     | Render protected Other as a non-expandable row.                           |
| `docs/architecture/financial-model.md`                                                 | Record the final persisted contract.                                      |

### Task 1: Establish the database contract

**Files:**

- Create: `supabase/migrations/20260806172545_add_other_direct_categories.sql`
- Modify: `supabase/tests/shared_balance.sql`

**Produces:** `transactions.category_id`, protected `other_income`/`other_expense` rows for every household, and one trigger that enforces all assignment cases.

- [ ] Write pgTAP assertions that reject a manual row with no assignment, both IDs, a direct normal category, wrong household/kind, archived Other, and a direct Other service period; assert each Other seed is protected and imports may be unassigned.
- [ ] Run `bun run test:db` only when its configured `JOINT_DEV_TEST_DB_URL` is intentionally available; otherwise record this as an unrun privileged check. The new assertions must fail before the migration exists.
- [ ] Create the migration with `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new add_other_direct_categories`.
- [ ] Add `category_id uuid` with composite `(household_id, category_id)` foreign key, an exclusivity check, and a manual-source assignment check that permits exactly one of `category_id` and `subcategory_id`.
- [ ] Replace `categories_system_key_check` and `private.seed_essential_categories(uuid)` so every existing and future household has immutable `Other` income and expense rows using `#d5d5c4`.
- [ ] Replace `private.validate_transaction_subcategory()` with a single validator: lock and validate normal child assignments as today; lock and validate direct assignments only when `categories.system_key` matches the transaction kind's Other key; reject dual IDs and direct service periods.
- [ ] Reject subcategory creation under an Other parent and extend category transaction-link protection to direct references.
- [ ] Re-run the pgTAP command and confirm the new assertions pass when the privileged test target is available.

### Task 2: Normalize direct assignment in server read models

**Files:**

- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/finance-types.ts`, `src/lib/dashboard-data.ts`, `src/lib/financial-report.ts`
- Test: `src/lib/finance-types.test.ts`, `src/lib/dashboard-data.test.ts`, `src/lib/financial-report.test.ts`

**Consumes:** Task 1's generated `transactions.category_id` column.

**Produces:** A transaction can expose either a parent-backed child assignment or a direct Other category without changing shared-balance arithmetic.

- [ ] Add a failing fixture for an expense direct Other transaction and assert it retains category ID, name, color, icon, and no subcategory label.
- [ ] Run `bun run test -- src/lib/finance-types.test.ts src/lib/dashboard-data.test.ts src/lib/financial-report.test.ts`; confirm it fails on the missing direct assignment.
- [ ] Regenerate linked types only after Task 1 has been applied to the intended environment; until then update no generated file by hand.
- [ ] Project active and historical direct categories with the existing category data, map direct Other to the same report-category aggregate as normal children, and return `Other` as its display label.
- [ ] Keep Bills/Groceries queries subcategory-driven and exclude direct Other from their protected subsets.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Persist and select Other transactions

**Files:**

- Modify: `src/app/actions/transactions.ts`, `src/lib/validation.ts`
- Modify: `src/components/transaction-sheet.tsx`
- Test: `src/app/actions/transactions.test.ts`, `src/lib/validation.test.ts`, `src/components/transaction-sheet.test.tsx`

**Consumes:** Task 2's normalized direct-category option.

**Produces:** The existing transaction Sheet submits exactly one kind-matched assignment and presents grey `Other` with no hierarchy suffix.

- [ ] Add failing action tests for direct expense/income Other success and direct normal-category, dual-ID, and missing-manual-assignment rejection.
- [ ] Add a failing Sheet test that changes kind, offers exactly one grey `Other`, submits `categoryId`, and labels it `Other`.
- [ ] Run the focused action/component tests and confirm the new assertions fail.
- [ ] Parse optional `categoryId`, reject dual client input, verify direct category identity server-side, and write only the accepted assignment field in both create and update actions.
- [ ] Add direct Other entries to the existing kind-filtered selector; clear a stale selected ID when kind changes and preserve the existing Bills billing-period behavior for subcategories.
- [ ] Re-run the focused tests and confirm they pass.

### Task 4: Render and document protected Other rows

**Files:**

- Modify: `src/components/category-list.tsx`
- Modify: `src/components/category-list.test.tsx`
- Modify: `docs/architecture/financial-model.md`

**Consumes:** Task 1 system keys and Task 2 direct category metadata.

**Produces:** `/categories` visibly presents one protected grey Other row per kind without child-management affordances.

- [ ] Add a failing CategoryList test for a protected Other row with the grey side stripe and no disclosure, add-subcategory, edit, archive, or delete control.
- [ ] Run `bun run test -- src/components/category-list.test.tsx`; confirm the assertion fails.
- [ ] Recognize only the two Other system keys, render their plain row with existing accessible semantics, and leave all non-Other category behavior untouched.
- [ ] Update the financial-model record with direct Other persistence, labels, assignment validation, and report inclusion.
- [ ] Re-run the focused CategoryList test and confirm it passes.

### Task 5: Verify the complete flow

**Files:**

- Modify: `docs/superpowers/specs/2026-08-06-other-direct-categories-design.md` only if implementation changes its approved contract.

- [ ] Run the focused test commands from Tasks 2–4, `bun run lint`, `bunx tsc --noEmit`, and `git diff --check`; report each result separately and do not run a build.
- [ ] Before any linked Supabase operation, read `supabase/.temp/project-ref`, confirm it is `magcvzqnwrwxkhtsfspg`, confirm a single writer, run `supabase migration list --linked`, then `supabase db push --linked --dry-run`; stop before a live push until explicit authorization.
- [ ] In an authenticated browser, create and edit one income and one expense Other transaction, confirm the transaction Sheet selection, ledger/report label, category rows, keyboard focus, and desktop/mobile layout.
- [ ] Record generated-type, pgTAP, and browser evidence separately from unperformed hosted migration proof.

## Alternatives

- Hidden child records were rejected because they misrepresent the no-subcategory UI and leak a false hierarchy into reports.
- General direct category assignment was rejected because it weakens the category model beyond the two approved fallback categories.

## Risks and Assumptions

- The migration touches a shared contract and requires explicit authorization before any hosted push.
- Existing category UI files are dirty; their current user-authored behavior wins if it conflicts with this plan.
- `#d5d5c4` is the existing sixth category anchor and is the approved greyish color.
