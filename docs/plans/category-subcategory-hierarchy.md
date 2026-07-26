---
goal: "Finish the existing category/subcategory hierarchy in transaction entry, the ledger, and verification"
version: "2.0"
date_created: "2026-07-25"
last_updated: "2026-07-26"
owner: "Joint"
status: "Active"
tags: ["feature", "categories", "subcategories", "transactions", "verification"]
---

# Category and subcategory hierarchy implementation plan

> **For agentic workers:** Execute one task at a time and obtain a review gate before the next task.

**Goal:** Make every transaction surface use the existing subcategory data contract while preserving the current approved visual design.

**Architecture:** The database, Server Actions, and reporting layer already persist `transactions.subcategory_id` and roll expense totals to the parent category. Finish the read-model projection of a subcategory and use it in the existing transaction Sheet, ledger, filters, and dashboard activity. No schema change is required.

**Tech stack:** Next.js App Router, TypeScript, React, Vitest, Supabase/Postgres, Bun.

## Global constraints

- The current category-management and transaction visual design is frozen. Retain the current components, layout, control families, copy hierarchy, and six category color families.
- A category has a fixed family color. A subcategory persists one color from its parent family and may override the parent icon; it does not own a kind.
- Manual transactions require an active matching-kind subcategory. Statement imports and transactions whose category is deleted may remain uncategorized.
- Ledger filters and dashboard expense totals remain grouped by parent category. Transaction labels identify the selected parent and child as `Category → Subcategory`.
- Keep mutations in authenticated Server Actions; use generated database types; do not add a dependency or a migration for this work.
- Do not run `bun run build` unless the user explicitly asks. Do not create, switch, or push branches.
- Before any linked Supabase command, read `supabase/.temp/project-ref` and confirm `joint-dev` (`magcvzqnwrwxkhtsfspg`).

## Files and responsibilities

| File                                    | Responsibility                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/finance-types.ts`              | Preserve database subcategory color and icon in the application read model.                                       |
| `src/lib/financial-report.ts`           | Carry the presentation metadata needed by transaction surfaces without changing parent-category aggregation.      |
| `src/lib/dashboard-data.ts`             | Build active/inactive subcategory view data with parent name, kind, category ID, child color, and effective icon. |
| `src/components/transaction-sheet.tsx`  | Submit `subcategoryId` and select active matching-kind subcategories in the current Sheet.                        |
| `src/components/transaction-ledger.tsx` | Resolve transaction labels and category filters from `subcategoryId`.                                             |
| `src/app/(app)/page.tsx`                | Render recent activity from the hierarchy.                                                                        |
| `src/app/(app)/transactions/page.tsx`   | Pass the existing hierarchy to transaction entry and ledger surfaces.                                             |
| `src/components/ledger-controls.tsx`    | Keep the current parent-category filter UI while accepting the derived parent IDs.                                |
| `supabase/tests/shared_balance.sql`     | Prove the deployed hierarchy, privileges, color-family constraints, and deletion behavior.                        |
| `docs/architecture/financial-model.md`  | Record the final persisted hierarchy and reporting behavior.                                                      |

## Task 1: Complete the hierarchy read model

**Files:**

- Modify: `src/lib/finance-types.ts`
- Modify: `src/lib/financial-report.ts`
- Modify: `src/lib/dashboard-data.ts`
- Test: `src/lib/finance-types.test.ts`
- Test: `src/lib/dashboard-data.test.ts`

**Produces:** A subcategory view value with `id`, `name`, `categoryId`, `categoryName`, `kind`, `color`, `icon`, `archivedAt`, and `categoryArchivedAt`. `color` is the persisted child color. `icon` is the child override when present, otherwise the parent category icon.

- [ ] Add failing mapper tests for a subcategory row with a color and optional icon.
- [ ] Run `bun run test -- src/lib/finance-types.test.ts src/lib/dashboard-data.test.ts`; confirm the new assertions fail.
- [ ] Extend `subcategoryFromRow()` and `ReportSubcategory` to retain the generated row's `color` and `icon` fields.
- [ ] In `getDashboardData()`, combine each child with its parent. Preserve the child color, attach `categoryName`, `kind`, and `categoryId`, and set the effective icon with `child.icon ?? category.icon`.
- [ ] Exclude a child whose parent is missing; retain archived rows so historical transactions can still resolve their labels.
- [ ] Run `bun run test -- src/lib/finance-types.test.ts src/lib/dashboard-data.test.ts`; confirm the tests pass.

## Task 2: Wire transaction entry and display to subcategories

**Files:**

- Modify: `src/components/transaction-sheet.tsx`
- Modify: `src/components/transaction-ledger.tsx`
- Modify: `src/components/ledger-controls.tsx`
- Modify: `src/app/(app)/transactions/page.tsx`
- Modify: `src/app/(app)/page.tsx`
- Test: `src/components/transaction-sheet.test.tsx`
- Test: `src/components/transaction-ledger.test.tsx`
- Test: `src/components/ledger-controls.test.tsx`
- Test: `src/app/(app)/page.test.tsx`
- Test: `src/app/(app)/transactions/page.test.tsx`

**Consumes:** The Task 1 subcategory view values and existing `createTransaction`/`updateTransaction` actions, which accept `subcategoryId`.

**Produces:** Every manual transaction form submits `subcategoryId`; every resolved transaction label is `Category → Subcategory`; category filters continue to filter by the parent ID.

- [ ] Add failing Sheet tests proving that an income type exposes only active income subcategories, that a type change clears the selection, and that the hidden field is named `subcategoryId`.
- [ ] Replace the Sheet's category state, hidden input, field errors, and options with subcategory equivalents. Keep the current `PillSelect`, Sheet layout, field order, and selection styling. Label each option with its parent and child names and use the child color/effective icon already provided by the read model.
- [ ] On edit, initialize the selected child from `transaction.subcategoryId`; leave imported uncategorized transactions blank.
- [ ] Pass active subcategories, rather than parent categories, to every `TransactionSheet` instance from the dashboard, transactions route, and ledger edit path.
- [ ] Add failing ledger and dashboard tests for `Category → Subcategory` labels, an uncategorized fallback, and parent-category filtering of transactions assigned to any of that parent's children.
- [ ] Resolve each ledger and recent-activity transaction through its `subcategoryId`. Use the existing neutral `Uncategorized` fallback only when the ID is null or the hierarchy row is unavailable.
- [ ] Preserve the current category filter controls and URL parameter. Derive a transaction's filter category ID from its selected subcategory's `categoryId`; do not add a subcategory filter.
- [ ] Run `bun run test -- src/components/transaction-sheet.test.tsx src/components/transaction-ledger.test.tsx src/components/ledger-controls.test.tsx src/app/'(app)'/page.test.tsx src/app/'(app)'/transactions/page.test.tsx`; confirm the tests pass.

## Task 3: Verify the database contract on `joint-dev`

**Files:**

- Modify: `supabase/tests/shared_balance.sql`

**Produces:** A hosted database test that asserts the deployed hierarchy contract.

- [ ] Extend the SQL test's RLS catalog assertion to include `public.subcategories` and assert authenticated CRUD privileges plus revoked `anon` privileges for that table.
- [ ] Add cases that prove a member can create a child in their household, cannot create or select a child across households, and cannot use a child under a category of the wrong kind.
- [ ] Add cases that reject assigning an archived child or archived parent to a transaction and allow an imported transaction with a null `subcategory_id`.
- [ ] Add cases that create a category and children through the deployed functions, assert that the category uses one of the six registered family colors, and assert each child color belongs to its parent's family.
- [ ] Add a deletion case proving that deleting a category removes its children and sets linked transaction `subcategory_id` to null.
- [ ] Read `supabase/.temp/project-ref`; proceed only if it contains `magcvzqnwrwxkhtsfspg`.
- [ ] Run `bun run test:db` with the user-provided `JOINT_DEV_TEST_DB_URL`; record the pass/fail output separately from local checks.

## Task 4: Document and run the completion gate

**Files:**

- Modify: `docs/architecture/financial-model.md`
- Test: focused tests from Tasks 1–3

**Produces:** Durable documentation of the implemented data contract and a clear evidence record.

- [ ] Update the financial-model table and narrative to name `subcategories`, `transactions.subcategory_id`, persisted child family colors, effective icon resolution, parent-category reporting, and uncategorized deletion/import behavior.
- [ ] Keep `docs/design.md` unchanged.
- [ ] Run `bun run lint`.
- [ ] Run `bun run test`.
- [ ] Run `bun run test:db` only after the project-ref and connection-string checks in Task 3 pass.
- [ ] Report local lint/test evidence and hosted `joint-dev` database evidence separately. If any check fails, fix its root cause before marking this plan complete.

## Acceptance criteria

- Manual transactions submit only a matching active `subcategoryId`.
- Statement imports and orphaned historical transactions render as `Uncategorized` and remain valid.
- Transaction entry, ledger rows, and dashboard recent activity resolve assigned values as `Category → Subcategory` without changing their approved visual structure.
- Category filters and expense totals group by the parent category.
- Child colors remain constrained to their parent's six-family palette, and icon fallback uses the parent category icon.
- Database tests prove RLS, privileges, ownership, kind, archive, color-family, and deletion behavior on `joint-dev`.
