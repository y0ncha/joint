---
goal: "Replace transaction categories with category-owned subcategories and expand automatic category colors"
version: "1.1"
date_created: "2026-07-25"
last_updated: "2026-07-26"
owner: "Joint"
status: "Planned"
tags: ["feature", "database", "categories", "subcategories", "ui", "breaking-change"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Replace the single-level category model with top-level categories and their subcategories. Transactions reference only subcategories; subcategories inherit their parent category color; dashboard expense totals remain grouped by category. This is an intentional destructive migration: existing categories and transactions are removed before the user recreates categories and re-imports transactions.

## 1. Requirements & Constraints

- **REQ-001**: Store top-level categories in `public.categories` and their children in a new `public.subcategories` table; do not use recursive category rows.
- **REQ-002**: Store `household_id`, `category_id`, `name`, `archived_at`, `created_at`, and `updated_at` on every subcategory; do not store `kind` or `color` on a subcategory.
- **REQ-003**: Replace `public.transactions.category_id` with nullable `public.transactions.subcategory_id`; new manual transactions require a subcategory, while statement-import rows and transactions whose category is deleted may remain uncategorized.
- **REQ-004**: Require every selected transaction subcategory to belong to the transaction household and to a category with the same income/expense kind.
- **REQ-005**: Render transaction selection and ledger labels as `Category → Subcategory`; use the parent category color for every subcategory badge.
- **REQ-006**: Aggregate dashboard expense totals by the parent category, not by subcategory.
- **REQ-007**: Give each new category one random unused color from the exact 46-value `categoryPastelColors` registry listed in **PAT-001**; repeat a value only after all registry values are used in that household.
- **REQ-008**: Expose all 46 category pastel colors in the existing category color picker and retain arbitrary custom hex color selection.
- **REQ-009**: Keep the existing five-color member palette and browser-local accent palette unchanged.
- **SEC-001**: Enable RLS on `public.subcategories` and allow only household members to manage rows using the same membership predicate as `public.categories`.
- **SEC-002**: Use composite household foreign keys and database triggers to reject cross-household subcategory references and kind mismatches independently of Server Action validation.
- **SEC-003**: Explicitly grant authenticated application access to `public.subcategories` while keeping `anon` access revoked; RLS remains the household row boundary.
- **CON-001**: The migration is intentionally breaking and must `TRUNCATE public.transactions, public.categories CASCADE` before it creates the new transaction-subcategory relation; do not migrate or fabricate legacy assignments.
- **CON-002**: Add a new ordered migration; never edit an applied migration.
- **CON-003**: Preserve the current unrelated dirty transaction/ledger worktree changes and stage only files belonging to this plan.
- **CON-004**: When this plan conflicts with intentional codebase changes present at execution time, preserve the codebase behavior and adapt this plan's implementation around it.
- **GUD-001**: Use Bun and run `bun run lint`, `bun run test`, and `bun run build` before implementation approval.
- **PAT-001**: Define `categoryPastelColors` exactly as `#f1f5f9`, `#e2e8f0`, `#f3f4f6`, `#e5e7eb`, `#f4f4f5`, `#e4e4e7`, `#f5f5f5`, `#e5e5e5`, `#f5f5f4`, `#e7e5e4`, `#fee2e2`, `#fecaca`, `#ffedd5`, `#fed7aa`, `#fef3c7`, `#fde68a`, `#fef9c3`, `#fef08a`, `#ecfccb`, `#d9f99d`, `#dcfce7`, `#bbf7d0`, `#d1fae5`, `#a7f3d0`, `#ccfbf1`, `#99f6e4`, `#cffafe`, `#a5f3fc`, `#e0f2fe`, `#bae6fd`, `#dbeafe`, `#bfdbfe`, `#e0e7ff`, `#c7d2fe`, `#ede9fe`, `#ddd6fe`, `#f3e8ff`, `#e9d5ff`, `#fae8ff`, `#f5d0fe`, `#fce7f3`, `#fbcfe8`, `#ffe4e6`, `#fecdd3`, `#dcece3`, and `#ece5f4`; use these exact lowercase values in TypeScript and SQL.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Establish the destructive category/subcategory database contract and regenerate generated types.

| Task     | Description                                                                                                                                                                                                                                                                           | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-001 | Add one new `supabase/migrations/<timestamp>_category_subcategory_hierarchy.sql` migration that truncates `public.transactions` and `public.categories` with cascade, creates `public.subcategories`, explicitly grants authenticated application access while keeping `anon` revoked, enables its RLS policy, and verifies the table has no `color` or `kind` column. | Completed | 2026-07-26 |
| TASK-002 | Replace `transactions.category_id` with `transactions.subcategory_id` in the migration, add the transaction check constraints and partial index, and verify manual rows require a subcategory while imported rows may use `NULL`.                                                     | Completed | 2026-07-26 |
| TASK-003 | Replace `public.validate_transaction_category()` with a subcategory-aware validator that locks the subcategory and parent category, verifies household and kind, and rejects references to archived categories or subcategories.                                                      | Completed | 2026-07-26 |
| TASK-004 | Add database guards that reject changing a category household or kind, or changing a subcategory household or parent category, after a transaction references the subcategory.                                                                                                        | Completed | 2026-07-26 |
| TASK-005 | Replace the five-color category insert trigger with a `private.next_category_pastel(household_id)` helper that chooses randomly from unused `PAT-001` colors and falls back to all colors after exhaustion; verify member-color functions remain unchanged.                           | Completed | 2026-07-26 |
| TASK-006 | Regenerate `src/lib/database.types.ts` from the migrated `joint-dev` schema and verify it exposes `subcategories` and `transactions.subcategory_id` without `transactions.category_id`.                                                                                               | Completed | 2026-07-26 |

### Implementation Phase 2

- **GOAL-002**: Propagate the category/subcategory contract through authenticated actions, report types, and data loading.

| Task     | Description                                                                                                                                                                                                                                    | Status  | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-007 | Replace `categoryId` with `subcategoryId` in `src/lib/validation.ts`, `src/app/actions/transactions.ts`, and their tests; validate a manual transaction always supplies a subcategory identifier.                                              | Completed | 2026-07-26 |
| TASK-008 | Add authenticated category and subcategory Server Actions in `src/app/actions/categories.ts` that scope all queries to the current household and revalidate `/`, `/transactions`, and `/categories`. Deletion cascades children and leaves linked transactions uncategorized. | Completed | 2026-07-26 |
| TASK-009 | Update `src/lib/finance-types.ts` and `src/lib/financial-report.ts` so report transactions expose `subcategoryId`, report subcategories carry their parent category ID, and expense totals accumulate under parent category IDs.               | Completed | 2026-07-26 |
| TASK-010 | Update `src/lib/dashboard-data.ts` to load categories and subcategories in the current household, construct inherited-color subcategory view data, and pass both collections to `buildMonthlyReport`.                                          | Completed | 2026-07-26 |
| TASK-011 | Update all page, action, financial-report, dashboard-data, and transaction test fixtures to use subcategory IDs and parent-category totals.                                                                                                    | Planned |      |

### Implementation Phase 3

- **GOAL-003**: Deliver hierarchy management and subcategory-only transaction selection with inherited colors.

| Task     | Description                                                                                                                                                                                                                                                                                | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| TASK-012 | Add `categoryPastelColors`, `isCategoryPastelColor`, and an unused-first random selector to `src/lib/shared-colors.ts`, using the exact `PAT-001` registry and a deterministic injectable random source in its unit tests.                                                                 | Completed | 2026-07-26 |
| TASK-013 | Update `src/app/(app)/categories/page.tsx`, `src/components/category-form.tsx`, and `src/components/category-list.tsx` to choose one unused default category color, show all 46 preset swatches, and provide create, rename, archive, and list controls for each category's subcategories. | Planned |      |
| TASK-014 | Update `src/components/color-picker.tsx` so a caller-provided preset palette is excluded from custom-color recents, while member and accent picker defaults retain their existing behavior.                                                                                                | Planned |      |
| TASK-015 | Update `src/components/transaction-sheet.tsx`, `src/components/transaction-ledger.tsx`, and `src/components/pill-select.tsx` to select only active matching-kind subcategories, label options and ledger badges as `Category → Subcategory`, and render the inherited category color.      | Planned |      |
| TASK-016 | Update `src/app/(app)/page.tsx`, `src/app/(app)/transactions/page.tsx`, and associated tests so dashboard totals display parent category names and all transaction entry points receive subcategory options.                                                                               | Planned |      |

### Implementation Phase 4

- **GOAL-004**: Document, validate, and prepare the breaking change for user approval.

| Task     | Description                                                                                                                                                                                                       | Status  | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-017 | Update `docs/design.md` and `docs/architecture.md` to define the two-level taxonomy, inherited color rule, subcategory-only assignment, parent-category reporting, and destructive recreation/re-import workflow. | Planned |      |
| TASK-018 | Extend `supabase/tests/shared_balance.sql` to prove RLS, parent ownership, kind enforcement, archive rejection, random-unused category color assignment, and permitted imported uncategorized rows.               | Planned |      |
| TASK-019 | Run the focused TypeScript and SQL tests, then run `bun run lint`, `bun run test`, and `bun run build`; mark every completed task only after its stated checks pass.                                              | Planned |      |
| TASK-020 | After TASK-005, apply and verify the migration only against `joint-dev`, confirming the active project before every linked Supabase command; then complete TASK-006 type generation. Destructive impact and data deletion were approved on 2026-07-26. | Completed | 2026-07-26 |

## 3. Alternatives

- **ALT-001**: Add `parent_id` to `public.categories`; rejected because a dedicated subcategories table structurally prevents a transaction from referencing a category and prevents subcategories from owning colors or kinds.
- **ALT-002**: Generate pastel colors with unrestricted RGB or HSL randomness; rejected because it can create muddy or low-contrast colors and gives no stable registry for SQL and the picker.
- **ALT-003**: Retain and remap current category/transaction rows; rejected because the user explicitly requested a breaking change and will recreate categories and re-upload transactions.
- **ALT-004**: Add a new hierarchy picker dependency; rejected because the existing searchable `PillSelect` can present `Category → Subcategory` labels without another dependency.

## 4. Dependencies

- **DEP-001**: Hosted `joint-dev` Supabase project `magcvzqnwrwxkhtsfspg` for migration application and schema type generation; never apply this destructive migration to `joint-prod` without separate explicit authorization.
- **DEP-002**: Existing `react-color`, shadcn-owned controls, Supabase SSR request client, and generated `Database` types.
- **DEP-003**: User must recreate top-level categories, add their subcategories, and re-upload statement transactions after the `joint-dev` migration succeeds.

## 5. Files

- **FILE-001**: `supabase/migrations/<timestamp>_category_subcategory_hierarchy.sql` — destructive schema reset, `subcategories` table, RLS, integrity triggers, and category pastel trigger.
- **FILE-002**: `supabase/tests/shared_balance.sql` — database authorization, hierarchy, archive, and color assignment coverage.
- **FILE-003**: `src/lib/database.types.ts`, `src/lib/finance-types.ts`, `src/lib/financial-report.ts`, `src/lib/dashboard-data.ts`, and their tests — generated schema and reporting/data contracts.
- **FILE-004**: `src/app/actions/categories.ts`, `src/app/actions/transactions.ts`, and `src/lib/validation.ts` — authenticated mutation and input contracts.
- **FILE-005**: `src/app/(app)/categories/page.tsx`, `src/components/category-form.tsx`, `src/components/category-list.tsx`, `src/components/color-picker.tsx`, `src/components/transaction-sheet.tsx`, `src/components/transaction-ledger.tsx`, and `src/components/pill-select.tsx` — management, selection, and inherited-color UI.
- **FILE-006**: `docs/design.md` and `docs/architecture.md` — durable product and data-contract documentation.

## 6. Testing

- **TEST-001**: Assert `categoryPastelColors` has exactly 46 unique six-digit lowercase hex values, chooses an unused value when possible, and returns a registry value after all are used.
- **TEST-002**: Assert category creation submits its shown default or manually selected palette/custom color, and subcategory creation never receives or persists a color field.
- **TEST-003**: Assert category and subcategory actions reject malformed names, scope mutations to the verified household, and revalidate all affected routes.
- **TEST-004**: Assert transaction actions write `subcategory_id`, reject absent manual subcategories, and preserve statement-import uncategorized behavior.
- **TEST-005**: Assert the database rejects cross-household, archived, and wrong-kind subcategory assignments, while allowing a matching active subcategory in the same household.
- **TEST-006**: Assert monthly expense totals group multiple subcategories beneath their parent category and ledger/selector labels show the parent plus child name with the parent color.
- **TEST-007**: Pass `bun run lint`, `bun run test`, `bun run build`, and the applicable hosted `joint-dev` database verification before implementation approval.

## 7. Risks & Assumptions

- **RISK-001**: The migration irreversibly deletes existing category and transaction rows in its target project; apply it only after confirming `joint-dev` and user readiness to recreate/re-import.
- **RISK-002**: The color registry is duplicated between TypeScript and SQL; enforce identical values with a focused test and keep the list in the same order in both locations.
- **RISK-003**: Category archiving hides all of its subcategories from transaction selection; archived historical rows remain reportable because the read model loads archived parents and children.
- **ASSUMPTION-001**: Top-level categories may initially have zero subcategories but cannot be selected for any transaction; users add a subcategory before recording a manual transaction.
- **ASSUMPTION-002**: Subcategories are available for both income and expense, inherit their parent category kind, and may be renamed or archived but are not reparented by the UI.
- **ASSUMPTION-003**: The dashboard has parent-category totals only; a subcategory breakdown is outside this plan.

## 8. Related Specifications / Further Reading

- [Joint design contract](../design.md)
- [Joint architecture index](../architecture.md)
- [Shared budget MVP plan](shared-budget-mvp.md)
- [Statement import plan](transactions-statement-import.md)
- [Tailwind color palette](https://tailwindcss.com/docs/colors)
