---
goal: Add protected Bills and Groceries domains with an analytics-only Bills & Groceries dashboard
version: 2.0
date_created: 2026-07-27
last_updated: 2026-07-30
owner: Joint maintainers
status: "Planned"
tags: [feature, bills-groceries, bills, groceries, analytics, charts, migration, settings]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan replaces the earlier prorated-ledger design with an `Bills & Groceries` analytics route. The ledger and shared balance remain exact snapshots of stored transaction amounts and posting dates. Bills additionally store an inclusive service period used only for prorated Bills & Groceries analytics. Groceries analytics use actual posting dates, one optional fixed monthly household budget, and the protected `Main run` and `Top-ups` subcategories.

## 1. Requirements & Constraints

- **REQ-001**: Every household MUST have exactly one active protected expense category with `categories.system_key = 'bills'`, `name = 'Bills'`, icon `receipt`, and exactly one active protected expense category with `categories.system_key = 'groceries'`, `name = 'Groceries'`, icon `shopping-basket`.
- **REQ-002**: `Bills` and `Groceries` MUST reject deletion, archival, renaming, kind changes, and `system_key` changes at the database boundary while permitting color and icon customization.
- **REQ-003**: Members MUST be able to create, edit, move, and delete user-managed subcategories beneath `Bills`.
- **REQ-004**: `Groceries` MUST contain exactly two protected children: `Main run` with `subcategories.system_key = 'main_run'` and `Top-ups` with `subcategories.system_key = 'top_ups'`.
- **REQ-005**: The protected Groceries children MUST reject deletion, archival, renaming, parent changes, and `system_key` changes while permitting color and icon customization; members MUST NOT create or move any additional child beneath `Groceries`.
- **REQ-006**: The authorized migration MUST delete all rows from `transactions`, `categories`, and `subcategories`, preserve all rows in `households`, `profiles`, `household_members`, `household_allowed_members`, and `member_cards`, including opening balances stored on `households`, then seed all protected categories and children atomically for existing households.
- **REQ-007**: Future household creation MUST seed both protected categories and both protected Groceries children in the same database transaction.
- **REQ-008**: `TransactionSheet` MUST show one `Billing period` range control only when the selected subcategory belongs to `Bills`.
- **REQ-009**: A Bills transaction MUST persist `service_period_start` and `service_period_end`; every non-Bills transaction MUST persist both columns as `NULL`.
- **REQ-010**: A billing period MUST use inclusive ISO dates, require `service_period_start <= service_period_end`, and contain no more than 366 calendar days.
- **REQ-011**: Selecting a Bills subcategory for a transaction without a stored period MUST initialize both period endpoints to `occurred_on`; selecting a non-Bills subcategory MUST clear both endpoints.
- **REQ-012**: The ledger, overview, monthly report, custom-range report, and shared balance MUST continue using each stored transaction's full `amount` and `occurred_on`; they MUST NOT show, sum, or persist prorated projections.
- **REQ-013**: Bills analytics MUST convert each amount to integer agorot, distribute it across every day of the full inclusive service period, assign remainder agorot to the earliest service days, clip only after allocation, and preserve the exact original amount.
- **REQ-014**: Bills analytics MUST consolidate allocations by Bills subcategory and calendar month without modifying source transactions.
- **REQ-015**: `households.groceries_monthly_budget` MUST be nullable unconstrained `numeric`; when non-NULL, database checks MUST require it to be positive, finite, have scale no greater than two, and have absolute magnitude below `10000000000`. Either household member may edit it.
- **REQ-016**: Settings MUST add an `Bills & Groceries` card between `Household` and `Account` containing one `Monthly groceries budget` field integrated into the existing shared Save, dirty-state, navigation-warning, success, and error behavior.
- **REQ-017**: Clearing `Monthly groceries budget` MUST persist `NULL`; an unset budget MUST hide the chart threshold and show a concise Settings prompt without blocking Bills & Groceries.
- **REQ-018**: Add `/bills-groceries` to desktop and mobile primary navigation with the accessible label `Bills & Groceries`.
- **REQ-019**: The Bills & Groceries configuration popover MUST switch the monthly charts between `Past 12 months` and `Calendar year`, store the choice in `period=rolling|calendar`, and treat missing or invalid values as `rolling`.
- **REQ-020**: `rolling` MUST include the current calendar month and the preceding eleven months; `calendar` MUST include January through December of the current year, including zero-value future months.
- **REQ-021**: The `Bills by month` chart MUST render one stacked column per displayed month, use one stack per selected Bills subcategory, default to every Bills subcategory, reject an empty selection, and store valid selections in the comma-separated `bills` URL parameter.
- **REQ-022**: The `Bills by month` multi-selector MUST use each subcategory's label and color and MUST update the URL without losing the period, YoY selection, or Groceries range.
- **REQ-023**: The `Year-over-year` chart MUST render adjacent columns for one Bills subcategory: the displayed month in its normal color and the same month one year earlier in a muted version.
- **REQ-024**: The YoY subcategory MUST come from the `bill` URL parameter when valid and otherwise default to the highest-spend Bills subcategory in the displayed window, breaking equal totals by case-insensitive name.
- **REQ-025**: A missing prior-year value MUST render the current column and the text `No previous-year data`; no Bills data MUST render a concise empty state.
- **REQ-026**: The `Groceries by month` chart MUST render stacked `Main run` and `Top-ups` columns from original transaction amounts and posting dates and MUST draw a labelled horizontal budget threshold only when the fixed budget is present.
- **REQ-027**: The `Groceries by day` chart MUST default to the current month and support `groceryMonth=YYYY-MM`. Missing or invalid values, including legacy `groceryFrom` and `groceryTo` parameters, MUST canonicalize to the approved monthly default.
- **REQ-028**: The daily chart MUST include every calendar date in the selected month, including zero-spend dates, and sum same-day transactions separately into `Main run` and `Top-ups`.
- **REQ-029**: The daily chart MUST use a GitHub-style calendar heatmap of total daily Groceries spend, with a neutral zero-spend cell and increasing intensity for higher totals.
- **REQ-030**: The selected month MUST retain every calendar date in its calendar position; the heatmap MUST NOT aggregate or drop dates.
- **REQ-031**: Monthly charts MUST show labelled axes, exact ILS tooltips, visible text legends, non-color labels, keyboard-accessible chart layers, and an accessible table containing the same values. The Daily heatmap MUST show weekday labels, a labelled intensity legend, keyboard-focusable day cells with exact ILS values, and its accessible table containing Main run, Top-ups, and total values.
- **REQ-032**: At the shared `xl` viewport threshold, Bills & Groceries MUST render `Bills by month` and `Year-over-year` in one row and `Groceries by month` with `Groceries by day` in the next; the monthly chart fills the remaining width and the day heatmap stays squarish. Smaller layouts MUST stack all four cards full-width in the same order.
- **REQ-033**: Bills & Groceries MUST use bounded household-scoped queries for only the displayed window, required prior-year window, and Bills service periods that overlap either window; it MUST NOT call the existing all-transactions `getDashboardData()` path.
- **REQ-034**: The server MUST return compact chart series to the client and MUST NOT add aggregate tables, materialized views, synchronization triggers, or a second financial source of truth.
- **SEC-001**: Every mutation MUST derive the authenticated user and household on the server; browser input MUST NOT supply a trusted household ID, system key, built-in flag, or membership role.
- **SEC-002**: Database constraints and triggers MUST enforce protected identities, exact Groceries membership, service-period rules, household isolation, and budget validity when the UI is bypassed.
- **SEC-003**: New public columns and functions MUST retain current household RLS, explicit privileges, safe `search_path` declarations, and revoked execution from `public` and `anon`.
- **CON-001**: Transactions MUST continue referencing subcategories only; this feature MUST NOT restore `transactions.category_id`.
- **CON-002**: Imported transactions MUST remain uncategorized on import; assigning an imported transaction to Bills later MUST require a billing period without changing its import provenance.
- **CON-003**: Use the owned shadcn `Chart` primitive backed by Recharts, the existing `Card`, `Popover`, `Calendar`, `Field`, `Input`, `PillSelect`, and semantic tokens; do not create a chart framework or add another visualization dependency.
- **CON-004**: Chart colors MUST use stored category/subcategory colors and semantic opacity for prior-year comparison; personal accent MUST NOT redefine expense meaning.
- **CON-005**: Preserve keyboard access, visible focus, live feedback, reduced-motion behavior, and 44px mobile targets.
- **CON-006**: Stop after the visual-only Bills & Groceries and billing-range checkpoint until the user explicitly approves the rendered desktop and mobile result.
- **CON-007**: Do not run `bun run build`; do not create or switch branches, commit, push, deploy, apply hosted migrations, or mutate production outside separately authorized steps.
- **GUD-001**: Use UTC ISO calendar arithmetic and integer agorot; never use local-midnight dates or floating-point currency division.
- **GUD-002**: Measure final SQL with `EXPLAIN (ANALYZE, BUFFERS)` before adding any index beyond the planned service-period overlap index.
- **PAT-001**: Identify built-ins only by stable nullable `system_key` columns; never trigger protected or analytical behavior from display names.
- **PAT-002**: Keep analytics pure in `src/lib/bills-groceries.ts`, data access bounded in `src/lib/bills-groceries-data.ts`, and chart interaction inside one client component.
- **AUTH-001**: The user explicitly authorized the Phase 2 financial reset for development and the future production migration while preserving the records named in REQ-006; applying either environment remains a separately gated operation.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish the approved product contract and obtain visual confirmation of the final Bills & Groceries surfaces.
- DEPENDENCIES: None.
- COMPLETION CRITERIA: The design contract matches REQ-001 through REQ-034, the actual final chart primitives render fixture data on desktop and mobile, and the user marks the checkpoint `Approved`.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                    | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| TASK-001 | Update `docs/design.md` navigation, forms, settings, charts, accessibility, and visible-MVP sections with the approved Bills & Groceries contract and verify budgets and bills are no longer listed as wholly excluded features.                                                                                                                                                                                               | Complete | 2026-07-30 |
| TASK-002 | Run `/Users/yonatan/.bun/bin/bunx --bun shadcn@latest add chart --dry-run`, review the proposed files and dependency, then add the owned Chart primitive and verify only `src/components/ui/chart.tsx`, `package.json`, and `bun.lock` receive registry-owned changes.                                                                                                                                                         | Complete | 2026-07-30 |
| TASK-003 | Add the final fixture-driven `/bills-groceries` route in `src/app/(app)/bills-groceries/page.tsx` and chart composition in `src/components/bills-groceries-dashboard.tsx`, render all four approved cards and controls without database behavior, and verify desktop and mobile visual states.                                                                                                                                 | Approved | 2026-07-30 |
| TASK-004 | Add the conditional fixture-driven `Billing period` control to `src/components/transaction-sheet.tsx`, using an explicit fixture-only parent `systemKey` for create/edit checkpoint rendering because the real read model does not expose it until TASK-014/TASK-029; do not infer it from display names or wire it into live callers. Render create and edit states, then stop until the user approves TASK-003 and TASK-004. | Approved | 2026-07-30 |
| TASK-005 | Record the approved card geometry, labels, chart density, scrolling, selector behavior, range-control placement, and mobile presentation in this plan and set TASK-003 and TASK-004 to `Approved` with the approval date.                                                                                                                                                                                                      | Complete | 2026-07-30 |

#### Approved visual checkpoint (2026-07-30)

- At the shared `xl` viewport threshold, desktop renders `Bills by month` and `Year-over-year` in the first responsive row, then `Groceries by month` and `Groceries by day` in the second with the month chart filling the remaining width and the day heatmap squarish. Smaller layouts stack all four cards in that order.
- Cards retain their existing labels and fixture subtitles. Charts retain the approved density, labelled axes, and visible legends.
- Groceries by day preserves daily detail through its calendar heatmap. Default cards remain chart-only; expanded cards reveal their equivalent accessible tables.
- Bills configuration offers rolling and calendar periods plus a non-empty multi-select. The fixture-only `Billing period` control remains unwired to live callers until the later data-contract work.

### Implementation Phase 2

- GOAL-002: Reset financial data and establish protected Bills & Groceries schema contracts.
- DEPENDENCIES: TASK-003 and TASK-004 MUST be `Approved`.
- COMPLETION CRITERIA: The reviewed migration and post-push pgTAP verification on `joint-dev` prove the authorized reset, deterministic seeding, future provisioning, protected identities, budget permissions, service periods, RLS, and grants.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-006 | Run `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new bills-groceries_dashboard` and use the returned file as the sole Phase 2 migration source. The generated migration file MUST exist once in the repository; no local Supabase stack is used. `supabase migration list --linked` MUST confirm `joint-dev` matches every preceding local migration. The generated migration remains pending until its complete reviewed SQL is ready for the approved linked push sequence. | Complete | 2026-07-30 |
| TASK-007 | In the generated Bills & Groceries migration, atomically truncate `public.transactions` and `public.categories` with dependent subcategories while preserving REQ-006 records, then verify row counts and opening balances prove the authorized reset boundary.                                                                                                                                                                                                                    | Complete | 2026-07-30 |
| TASK-008 | In the generated Bills & Groceries migration, add nullable `categories.system_key` and `subcategories.system_key`, exact partial unique indexes and checks, deterministic existing/future household seeds, and protection triggers and verify every household has only the required built-ins.                                                                                                                                                                                     | Complete | 2026-07-30 |
| TASK-009 | In the generated Bills & Groceries migration, add nullable transaction service-period columns, paired/order/366-day checks, extend `private.validate_transaction_subcategory()`, and verify only active Bills children accept non-null periods.                                                                                                                                                                                                                                    | Complete | 2026-07-30 |
| TASK-010 | In the generated Bills & Groceries migration, add nullable unconstrained `households.groceries_monthly_budget numeric` with positive, finite, scale-at-most-two, and absolute-magnitude-below-`10000000000` checks, plus the member-authorized `save_current_settings` contract, and verify owner and member may set or clear it while nonmembers fail.                                                                                                                            | Complete | 2026-07-30 |
| TASK-011 | In the generated Bills & Groceries migration, add `transactions_household_service_period_idx` on `(household_id, service_period_start, service_period_end)` where both period columns are non-null and verify the overlap query can use it.                                                                                                                                                                                                                                        | Complete | 2026-07-30 |
| TASK-012 | Extend `supabase/tests/shared_balance.sql` with reset-boundary, seed, protection, exact-child, future-household, budget, period, import, RLS, privilege, and trigger cases, then after the reviewed migration push run `SUPABASE_TELEMETRY_DISABLED=1 supabase test db --linked supabase/tests/shared_balance.sql` against `joint-dev`.                                                                                                                                            | Complete | 2026-07-30 |
| TASK-013 | Regenerate `src/lib/database.types.ts` from the migrated `joint-dev` schema and verify its diff matches only the approved migration contract.                                                                                                                                                                                                                                                                                                                                      | Complete | 2026-07-30 |

### Implementation Phase 3

- GOAL-003: Implement deterministic Bills & Groceries analytics and bounded server data access.
- DEPENDENCIES: TASK-013 MUST be `Complete`.
- COMPLETION CRITERIA: Pure and data-access tests prove exact chart series, bounded queries, stable defaults, URL validation, and unchanged ledger reporting.

| Task     | Description                                                                                                                                                                                                                                                                                                     | Status   | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-014 | Extend `categoryFromRow()`, `subcategoryFromRow()`, and `transactionFromRow()` in `src/lib/finance-types.ts` with system keys and service periods and verify `src/lib/finance-types.test.ts` maps every new field.                                                                                              | Complete | 2026-07-30 |
| TASK-015 | Add `src/lib/bills-groceries.ts` with UTC range parsing, integer-agorot daily allocation, monthly consolidation, YoY alignment, grocery monthly stacks, complete daily series, highest-spend defaulting, and exact URL-default helpers and verify every exported function is pure.                              | Complete | 2026-07-31 |
| TASK-016 | Add `src/lib/bills-groceries.test.ts` cases for the `₪100.00` 2026-07-31 through 2026-08-03 allocation, uneven remainders, leap day, 366 days, multiple Bills consolidation, rolling and calendar windows, YoY gaps, budget absence, zero-spend dates, same-day Groceries sums, and deterministic tie-breaking. | Complete | 2026-07-31 |
| TASK-017 | Add `src/lib/bills-groceries-data.ts` with `getBills & GroceriesData()` that derives household scope, resolves built-ins, queries only required columns and date/period windows, and returns compact chart series without calling `getDashboardData()`.                                                         | Complete | 2026-07-31 |
| TASK-018 | Add `src/lib/bills-groceries-data.test.ts` proving household filters, posting-date Groceries bounds, overlapping Bills bounds, prior-year bounds, selected-column lists, empty states, and absence of an unbounded transactions query.                                                                          | Complete | 2026-07-31 |
| TASK-019 | Extend `src/lib/validation.ts` with optional paired billing-period validation and optional Groceries budget validation and verify `src/lib/validation.test.ts` covers empty, positive, precision, reversed, malformed, and oversized values.                                                                    | Complete | 2026-07-31 |
| TASK-020 | Extend `src/lib/financial-report.test.ts` and `src/lib/dashboard-data.test.ts` with Bills-period fixtures and verify ledger, overview, custom-range, and shared-balance outputs remain based only on full source amounts and posting dates.                                                                     | Complete | 2026-07-31 |
| TASK-021 | Run `EXPLAIN (ANALYZE, BUFFERS)` against representative bounded Groceries and Bills overlap queries, retain only the planned index unless evidence requires another reviewed index, and record the plans in the task evidence.                                                                                  | Complete | 2026-07-31 |

### Implementation Phase 4

- GOAL-004: Wire protected mutations, Settings persistence, navigation, and approved interactive charts.
- DEPENDENCIES: TASK-018, TASK-019, and TASK-020 MUST be `Complete`.
- COMPLETION CRITERIA: Action, route, component, and browser tests prove the approved user flows and no analytical projection leaks into the ledger.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-022 | Update `createTransaction()` and `updateTransaction()` in `src/app/actions/transactions.ts` to resolve the selected parent system key, require or clear service periods, preserve posting-date behavior and import provenance, and verify household-scoped failures return field errors.                                                                                                                                      | Complete | 2026-07-31 |
| TASK-023 | Update `src/app/actions/categories.ts` and category management components to expose appearance-only controls for protected rows, retain Bills child management, remove Groceries child creation/movement/deletion paths, and verify forged mutations fail safely at the database.                                                                                                                                             | Complete | 2026-07-31 |
| TASK-024 | Add `src/components/groceries-budget-settings-control.tsx`, render the `Bills & Groceries` card between Household and Account in `src/app/(app)/settings/page.tsx`, and verify both roles can stage a positive amount or an empty value.                                                                                                                                                                                      | Complete | 2026-07-31 |
| TASK-025 | Extend `saveSettings()` in `src/app/actions/profile.ts` and dirty tracking in `src/components/settings-save-control.tsx` to distinguish unchanged, set, and cleared budget states and verify one atomic save persists all staged fields.                                                                                                                                                                                      | Complete | 2026-07-31 |
| TASK-026 | Add the `Bills & Groceries` navigation item in `src/components/workspace-shell.tsx` and verify desktop/mobile ordering, active-path behavior, accessible labels, and 44px targets.                                                                                                                                                                                                                                            | Complete | 2026-07-31 |
| TASK-027 | Replace fixture data in `src/app/(app)/bills-groceries/page.tsx` with validated URL state and `getBills & GroceriesData()` output and verify invalid parameters, including legacy daily-range parameters, canonicalize to approved monthly defaults without losing unrelated selections.                                                                                                                                      | Complete | 2026-07-31 |
| TASK-028 | Complete `src/components/bills-groceries-dashboard.tsx` with shadcn Chart/Recharts stacked bars, grouped YoY bars, budget `ReferenceLine`, stacked lollipop composition, configuration Popover, bill selectors, month-only daily controls, tooltips, legends, and equivalent tables and verify every interaction updates the intended URL state.                                                                              | Complete | 2026-07-31 |
| TASK-029 | Complete `src/components/transaction-sheet.tsx` billing-period persistence and errors and verify selecting away from Bills clears the range while the transaction date remains the ledger date.                                                                                                                                                                                                                               | Complete | 2026-07-31 |
| TASK-030 | Add or extend focused tests for `src/app/actions/transactions.ts`, `src/app/actions/categories.ts`, `src/app/actions/profile.ts`, `src/components/transaction-sheet.tsx`, `src/components/bills-groceries-dashboard.tsx`, `src/components/settings-save-control.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/bills-groceries/page.tsx`, and `src/components/workspace-shell.tsx` and verify the approved behavior. | Planned  |            |

### Implementation Phase 5

- GOAL-005: Document the durable mechanism and verify local, hosted development, and release boundaries separately.
- DEPENDENCIES: TASK-012, TASK-021, and TASK-030 MUST be `Complete`.
- COMPLETION CRITERIA: Documentation, formatting, lint, full tests, browser verification, migration history, catalog checks, advisors, and generated types are reported as distinct evidence layers with every gap named.

| Task     | Description                                                                                                                                                                                                                                                                                        | Status  | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-031 | Add `docs/architecture/bills-groceries-analytics.md` with trust boundaries, reset, protected taxonomy, source-versus-analytics semantics, proration, bounded queries, budget persistence, URL state, chart accessibility, failure behavior, and non-goals and link it from `docs/architecture.md`. | Planned |      |
| TASK-032 | Update `docs/architecture/financial-model.md` and `docs/roadmap.md` to distinguish the implemented Bills & Groceries subset from future generalized budgets and obligations and verify neither document claims unverified delivery.                                                                | Planned |      |
| TASK-033 | Run the repository formatter on changed files, `bun run lint`, every focused test in Section 6, and `bun run test`, and report results without running `bun run build`.                                                                                                                            | Planned |      |
| TASK-034 | Verify desktop, mobile, keyboard-only, reduced-motion, empty, missing-budget, missing-YoY, month switching, transaction create/edit, both-role budget save, and ledger-isolation flows in the local browser.                                                                                       | Planned |      |
| TASK-035 | Immediately before any linked command, read `supabase/.temp/project-ref`, require `magcvzqnwrwxkhtsfspg`, confirm exclusive `joint-dev` migration-writer access, and stop if either check fails.                                                                                                   | Planned |      |
| TASK-036 | After explicit `joint-dev` mutation authorization, run linked migration list, dry-run push, push, and final migration list with `SUPABASE_TELEMETRY_DISABLED=1` and verify the immutable migration appears exactly once locally and remotely.                                                      | Planned |      |
| TASK-037 | After TASK-036, verify hosted reset counts, protected seeds, columns, constraints, triggers, RLS, grants, representative authenticated behavior, query plans, and Supabase advisors, regenerate hosted types, and confirm they match `src/lib/database.types.ts`.                                  | Planned |      |
| TASK-038 | Leave production migration and deployment exclusively to `.github/workflows/cd.yml` after separately authorized merge/release work and report that the approved destructive migration will execute before the application deployment.                                                              | Planned |      |

## 3. Alternatives

- **ALT-001**: Replace ledger rows and balance timing with prorated Bills projections; rejected because the ledger must remain an exact snapshot of real transactions and posting dates.
- **ALT-002**: Persist monthly Bills and Groceries aggregate tables; rejected because bounded household queries and server-side calculation are sufficient and aggregate synchronization would create a second failure-prone source of truth.
- **ALT-003**: Implement analytics in database views or RPCs immediately; rejected because pure TypeScript is easier to verify and evolve, while measured query bottlenecks can move to SQL later without changing the source schema.
- **ALT-004**: Detect built-ins by display name; rejected because names and appearance are presentation while protected behavior requires stable system keys.
- **ALT-005**: Allow arbitrary Groceries children and generate dynamic chart series; rejected because the approved taxonomy is exactly `Main run` and `Top-ups`.
- **ALT-006**: Render the daily Groceries view as one line with colored dots; rejected because one daily total cannot faithfully represent both subcategories, while a stacked lollipop shows cost and spending-day distribution together.
- **ALT-007**: Build charts with custom SVG or Canvas code; rejected because the owned shadcn Chart/Recharts stack already supplies the required composition, responsive layout, tooltips, legends, and accessibility layer.

## 4. Dependencies

- **DEP-001**: The user MUST approve the real fixture-driven visual checkpoint before Phase 2 begins.
- **DEP-002**: The project-local shadcn registry MUST provide `Chart`, which adds `src/components/ui/chart.tsx` and Recharts through Bun.
- **DEP-003**: Current `categories`, `subcategories`, `transactions`, `households`, `save_current_settings`, RLS, and pgTAP contracts MUST remain present until Phase 2 modifies them.
- **DEP-004**: Authenticated Supabase CLI access to migrated `joint-dev` MUST be available for linked pgTAP verification; no local Supabase stack is used.
- **DEP-005**: Hosted development proof requires explicit mutation authorization, authenticated Supabase CLI access, `joint-dev` project ref `magcvzqnwrwxkhtsfspg`, and exclusive writer access.
- **DEP-006**: Production execution requires a separately authorized release through `.github/workflows/cd.yml`; direct production migration remains prohibited.

## 5. Files

- **FILE-001**: `docs/plans/bills-groceries-dashboard.md` — approved source plan and delivery status.
- **FILE-002**: `docs/design.md` — visible Bills & Groceries, Settings, transaction-range, chart, and accessibility contract.
- **FILE-003**: The migration created by `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new bills-groceries_dashboard` under `supabase/migrations/` — destructive reset and complete schema contract.
- **FILE-004**: `supabase/tests/shared_balance.sql` — database behavior, reset, security, and regression coverage.
- **FILE-005**: `src/lib/database.types.ts` — generated schema and RPC types.
- **FILE-006**: `src/lib/finance-types.ts` and `src/lib/finance-types.test.ts` — row-model projection.
- **FILE-007**: `src/lib/bills-groceries.ts` and `src/lib/bills-groceries.test.ts` — pure analytics and URL defaults.
- **FILE-008**: `src/lib/bills-groceries-data.ts` and `src/lib/bills-groceries-data.test.ts` — bounded household data access.
- **FILE-009**: `src/lib/validation.ts`, `src/lib/validation.test.ts`, `src/lib/financial-report.test.ts`, and `src/lib/dashboard-data.test.ts` — validation and ledger-isolation regression coverage.
- **FILE-010**: `src/components/ui/chart.tsx`, `package.json`, and `bun.lock` — owned shadcn Chart primitive and Recharts dependency.
- **FILE-011**: `src/app/(app)/bills-groceries/page.tsx` and `src/app/(app)/bills-groceries/page.test.tsx` — Bills & Groceries route and validated URL state.
- **FILE-012**: `src/components/bills-groceries-dashboard.tsx` and `src/components/bills-groceries-dashboard.test.tsx` — four charts, controls, responsive composition, and accessible tables.
- **FILE-013**: `src/components/transaction-sheet.tsx` and `src/components/transaction-sheet.test.tsx` — conditional billing-period interaction.
- **FILE-014**: `src/components/groceries-budget-settings-control.tsx` and its focused test — optional shared budget input.
- **FILE-015**: `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/page.test.tsx`, `src/components/settings-save-control.tsx`, and `src/components/settings-save-control.test.ts` — Settings card, staged state, and shared Save.
- **FILE-016**: `src/app/actions/transactions.ts`, `src/app/actions/transactions.test.ts`, `src/app/actions/categories.ts`, `src/app/actions/categories.test.ts`, `src/app/actions/profile.ts`, and `src/app/actions/profile.test.ts` — trusted mutations.
- **FILE-017**: `src/components/category-list.tsx`, `src/components/category-list.test.tsx`, `src/components/category-form.tsx`, and `src/components/category-form.test.tsx` — protected taxonomy presentation.
- **FILE-018**: `src/components/workspace-shell.tsx` and `src/components/workspace-shell.test.tsx` — Bills & Groceries navigation.
- **FILE-019**: `docs/architecture/bills-groceries-analytics.md`, `docs/architecture.md`, `docs/architecture/financial-model.md`, and `docs/roadmap.md` — implemented durable architecture and remaining roadmap.

## 6. Testing

- **TEST-001**: Run `bun run test -- src/lib/bills-groceries.test.ts src/lib/bills-groceries-data.test.ts src/lib/finance-types.test.ts src/lib/validation.test.ts` and verify pure analytics, bounded queries, mappings, and validation.
- **TEST-002**: Run `bun run test -- src/lib/financial-report.test.ts src/lib/dashboard-data.test.ts` and verify Bills periods never change ledger, overview, range-report, or shared-balance amounts or dates.
- **TEST-003**: Run `bun run test -- src/app/actions/transactions.test.ts src/app/actions/categories.test.ts src/app/actions/profile.test.ts` and verify trusted transaction, taxonomy, and both-member budget mutations.
- **TEST-004**: Run `bun run test -- src/components/transaction-sheet.test.tsx src/components/bills-groceries-dashboard.test.tsx src/components/settings-save-control.test.ts src/app/'(app)'/settings/page.test.tsx src/app/'(app)'/bills-groceries/page.test.tsx src/components/workspace-shell.test.tsx` and verify UI, URL, Settings, navigation, chart, and accessibility behavior.
- **TEST-005**: Run `bun run test -- src/components/category-list.test.tsx src/components/category-form.test.tsx` and verify protected appearance controls, Bills child management, and exact Groceries children.
- **TEST-006**: After the reviewed migration push, run `SUPABASE_TELEMETRY_DISABLED=1 supabase test db --linked supabase/tests/shared_balance.sql` against `joint-dev` and verify the authorized reset boundary, protected seeds, periods, budget permissions, RLS, grants, and trigger assertions.
- **TEST-007**: Run `bun run lint` and `bun run test`; do not replace the full suite with focused evidence and do not run `bun run build`.
- **TEST-008**: In a local browser, verify a `₪100.00` Bills transaction dated 2026-07-31 with service period 2026-07-31 through 2026-08-03 remains one `₪100.00` July ledger row while Bills & Groceries shows `₪25.00` in July and `₪75.00` in August.
- **TEST-009**: In a local browser, verify rolling/calendar switching, all/default/custom Bills selections, highest-spend YoY default, missing prior year, budget present/absent, daily month switching, every zero day, stacked daily values, and the month-only heatmap layout.
- **TEST-010**: In a local browser, verify both members can set and clear the budget, dirty/logout protection remains correct, built-ins reject identity changes, Bills children remain manageable, and Groceries remains restricted.
- **TEST-011**: Verify each chart with keyboard-only navigation, reduced motion, visible focus, 44px controls, readable tooltips, non-color legends, and its equivalent table.
- **TEST-012**: After an authorized `joint-dev` push, compare migration history, reset counts, seeds, catalog definitions, RLS, privileges, advisors, query plans, authenticated behavior, and generated types with the repository and report hosted proof separately.

## 7. Risks & Assumptions

- **RISK-001**: The approved migration permanently deletes current financial classifications and transactions in each environment; execution MUST verify the exact target and retain the user's explicit authorization in AUTH-001.
- **RISK-002**: Production runs the destructive migration before application deployment, so release interruption leaves the old application against the new schema; CD evidence and forward-only recovery remain mandatory.
- **RISK-003**: Recharts increases the client bundle; route-local client composition and no second chart dependency limit the cost, and bundle optimization requires measured evidence.
- **RISK-004**: Calendar-month heatmaps must preserve every approved date without lossy aggregation.
- **RISK-005**: URL parameters can name deleted or cross-household subcategories; server validation MUST discard them before querying or rendering.
- **RISK-006**: Bills overlap queries may degrade at large scale; the planned partial index and measured query plans precede any aggregate storage.
- **RISK-007**: Both members may concurrently update the shared budget; atomic last-write-wins behavior is accepted for this single optional value.
- **ASSUMPTION-001**: `Past 12 months` includes the current month plus eleven preceding months.
- **ASSUMPTION-002**: `Calendar year` means January through December of the current year and does not add a year selector.
- **ASSUMPTION-003**: Bills begins with no default subcategories; households create the bill types they use.
- **ASSUMPTION-004**: `Main run` and `Top-ups` are the exact English labels and remain sentence case.
- **ASSUMPTION-005**: Empty Groceries budget means no threshold, not a zero budget.
- **ASSUMPTION-006**: The initial protected colors use the existing registered palettes and remain customizable after seeding.

## 8. Related Specifications / Further Reading

- [Joint design system](../design.md)
- [Joint architecture overview](../architecture.md)
- [Financial model](../architecture/financial-model.md)
- [Category and subcategory hierarchy plan](category-subcategory-hierarchy.md)
- [Statement import plan](transactions-statement-import.md)
- [Directional roadmap](../roadmap.md)
- [Repository contribution guide](../../AGENTS.md)
- [shadcn Chart documentation](https://ui.shadcn.com/docs/components/radix/chart)
