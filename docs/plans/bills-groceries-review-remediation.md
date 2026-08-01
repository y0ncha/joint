---
goal: Remediate Bills & Groceries review findings without changing ledger or authorization behavior
version: 1.0
date_created: 2026-08-01
last_updated: 2026-08-01
owner: Joint maintainers
status: "Planned"
tags: [bug, refactor, accessibility, analytics, nextjs, supabase]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan fixes the reviewed Bills & Groceries route, URL, pagination, YoY, validation, and UTC calendar defects. It permits breaking internal and route-identifier changes, preserves stored transaction amounts and posting dates as ledger truth, and does not change the database schema, hosted environments, approved Settings placement, or icon-only navigation.

## 1. Requirements & Constraints

- **REQ-001**: `year-over-year` MUST be the only Year-over-year chart identity in `BillsGroceriesChartId`, detail-route validation, generated links, selectors, conditions, and tests; `/bills-groceries/yoy` compatibility is not required.
- **REQ-002**: `ChartCard` MUST derive each detail link from its typed chart ID so a call site cannot emit a route segment different from the route validator.
- **REQ-003**: `alignBillYearOverYear()` MUST remain the single YoY alignment implementation and MUST calculate the selected Bill series rendered by the client.
- **REQ-004**: `getBillsGroceriesData()` MUST remove the unused `bills.yearOverYear` response field and MUST continue returning compact monthly Bill totals required for client selection.
- **REQ-005**: Each Bills, monthly Groceries, and daily Groceries transaction read MUST fetch every matching Data API row despite the configured per-response row limit.
- **REQ-006**: Transaction pagination MUST retain the existing household, subcategory, posting-date, and service-period bounds; use stable ascending `transactions.id` ordering; request inclusive `.range(from, to)` pages of at most 1,000 rows; use an exact matching-row count so a server cap below 1,000 cannot be mistaken for the final page; and stop with the existing sanitized load failure if a page errors or returns no progress before the count is satisfied.
- **REQ-007**: Dashboard and detail routes MUST use one normalized query-state implementation that preserves unrelated parameters, canonicalizes `period`, `bills`, `bill`, and `groceryMonth`, removes `groceryFrom` and `groceryTo`, and redirects before rendering when the requested query differs.
- **REQ-008**: Detail-route canonical redirects MUST retain the validated chart pathname, including `/bills-groceries/year-over-year`.
- **REQ-009**: Invalid groceries budgets MUST return `fieldErrors.groceriesBudget`, render the exact validation message beside `#groceries-budget`, set `aria-invalid` and `aria-describedby`, announce the error through the owned `FieldError`, and focus the input after the failed submission.
- **REQ-010**: `src/lib/date-range.ts` MUST own shared canonical ISO-date validation, UTC epoch-day conversion, UTC day shifting, inclusive day counting, ISO-month shifting, and ISO-month range calculation.
- **REQ-011**: Bills allocation, Bills/Groceries windows, transaction service-period validation, and financial-report calendar calculations MUST reuse the shared date-range functions without changing their financial policies or outputs.
- **REQ-012**: UTC consolidation MUST leave amount-to-agorot conversion, remainder allocation, clipping, reporting cutoffs, local-current-date policy, and URL-default policy in their current domain modules.
- **SEC-001**: Pagination MUST continue deriving the authenticated household from `getCurrentHouseholdContext()` and MUST NOT accept a household ID or protected system key from browser input.
- **SEC-002**: `saveSettings()` MUST continue authenticating and authorizing through `requireCurrentHousehold()` and persisting through the existing `save_current_settings` RPC.
- **FIN-001**: Stored `transactions.amount` and `transactions.occurred_on` MUST remain the sole ledger, report, and shared-balance truth; service-period proration remains analytics-only.
- **FIN-002**: Bills allocation MUST continue using UTC inclusive dates and integer agorot, including earliest-day remainder allocation before display-range clipping.
- **CON-001**: Do not modify `docs/plans/essentials-dashboard.md`, the current Household-card budget placement, or icon-only desktop/mobile navigation.
- **CON-002**: Do not add a dependency, database migration, RPC, aggregate table, materialized view, cache, route compatibility redirect, or new architectural layer.
- **CON-003**: Do not run `bun run build`, create or switch branches, commit, push, deploy, or execute linked Supabase commands.
- **CON-004**: Preserve the existing parallel execution of the three independent transaction read streams; pages within one stream execute sequentially.
- **GUD-001**: Prefer deletion and reuse: remove duplicate YoY logic and local date helpers before adding replacement code.
- **GUD-002**: Keep new helpers file-local unless at least two production modules consume them; shared UTC helpers belong in the existing `src/lib/date-range.ts`.
- **PAT-001**: Keep pure financial transformations in `src/lib/bills-groceries.ts`, bounded Data API access in `src/lib/bills-groceries-data.ts`, route normalization in `src/lib/bills-groceries-page.ts`, and Settings mutation authorization in `src/app/actions/profile.ts`.
- **PAT-002**: `isCanonicalIsoDate()` MUST return `false` for non-real or non-canonical dates; `isoDateToEpochDay()`, `shiftIsoDate()`, `inclusiveIsoDayCount()`, and `shiftIsoMonth()` MUST throw on invalid input; `epochDayToIsoDate()` MUST accept an integer UTC epoch day; and `getIsoMonthRange()` MUST return `undefined` for a non-canonical month.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish one tested owner for shared ISO/UTC calendar arithmetic without changing financial behavior.
- DEPENDENCIES: TASK-002 through TASK-005 require TASK-001 to be `Complete`; after TASK-001, TASK-002 through TASK-005 may execute in parallel.
- COMPLETION CRITERIA: `src/lib/date-range.test.ts`, `src/lib/bills-groceries.test.ts`, `src/lib/validation.test.ts`, and `src/lib/financial-report.test.ts` pass leap-day, month-end, inclusive-span, allocation, validation, and report regressions with the duplicate local UTC helpers removed.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                     | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-001 | Extend `src/lib/date-range.ts` with exported `isCanonicalIsoDate()`, `isoDateToEpochDay()`, `epochDayToIsoDate()`, `shiftIsoDate()`, `inclusiveIsoDayCount()`, `shiftIsoMonth()`, and `getIsoMonthRange()` functions and verify leap-day, invalid-date, year-boundary, month-end, and inclusive-span behavior in `src/lib/date-range.test.ts`.                                  | Complete | 2026-08-01 |
| TASK-002 | Replace `DAY_MS`, `isoDay()`, `dayIso()`, `monthIso()`, and `monthRange()` in `src/lib/bills-groceries.ts` with the Phase 1 date-range functions and verify allocation, monthly windows, daily zero filling, and URL defaults remain byte-for-byte equivalent in `src/lib/bills-groceries.test.ts`.                                                                             | Complete | 2026-08-01 |
| TASK-003 | Replace `monthEnd()` and `previousYearMonth()` in `src/lib/bills-groceries-data.ts` with `getIsoMonthRange()` and `shiftIsoMonth()` and verify the existing bounded Bills and Groceries windows remain unchanged in `src/lib/bills-groceries-data.test.ts`.                                                                                                                     | Complete | 2026-08-01 |
| TASK-004 | Replace the duplicate ISO-date validator and service-period day calculation in `src/lib/validation.ts` with `isCanonicalIsoDate()` and `inclusiveIsoDayCount()` and verify invalid real dates, reversed periods, leap days, and the 366-day limit in `src/lib/validation.test.ts`.                                                                                              | Complete | 2026-08-01 |
| TASK-005 | Replace `nextMonth()`, `previousMonths()`, `daysInMonth()`, `shiftDate()`, and UTC period-length arithmetic in `src/lib/financial-report.ts` with the Phase 1 date-range functions while retaining `localToday()` and report cutoff policy locally, then verify month-end capping, leap-day comparison, prior periods, and ledger totals in `src/lib/financial-report.test.ts`. | Complete | 2026-08-01 |

### Implementation Phase 2

- GOAL-002: Eliminate silent Data API truncation and duplicate YoY financial logic.
- DEPENDENCIES: TASK-001, TASK-002, and TASK-003 MUST be `Complete`; TASK-006 and TASK-009 may execute in parallel, TASK-007 requires TASK-006, TASK-008 requires TASK-007, and TASK-010 requires TASK-009.
- COMPLETION CRITERIA: More than one Data API page contributes to each affected aggregation, page errors fail safely, and selected-Bill YoY output comes only from `alignBillYearOverYear()`.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                  | Status  | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-006 | Add one generic file-local `readAllPages(loadPage)` helper in `src/lib/bills-groceries-data.ts` that fixes the first page's exact count as the expected total, advances the next inclusive range from the accumulated row count, rejects errors or no-progress responses, and returns every stable `id`-ordered compact row without exposing transaction rows to the client. Route the Bills transaction query through it so its behavior can be tested. | Complete | 2026-08-01 |
| TASK-007 | Route the monthly and daily Groceries transaction queries through `readAllPages()` inside the existing `Promise.all()`, preserve every current filter and selected financial column, and add `id` only for deterministic paging.                                                                                                                           | Complete | 2026-08-01 |
| TASK-008 | Extend the query mock and regressions in `src/lib/bills-groceries-data.test.ts` to prove continuation after a short server-capped page with a larger exact count, aggregation across multiple pages for all three streams, stable `id` ordering and ranges, and sanitized failure when a later page errors or makes no progress.                                             | Complete | 2026-08-01 |
| TASK-009 | Remove the `alignBillYearOverYear` import and `bills.yearOverYear` field from `src/lib/bills-groceries-data.ts` and delete the corresponding server-data fixtures and assertions from `src/lib/bills-groceries-data.test.ts` and `src/components/bills-groceries-dashboard.test.tsx`.                                                                                        | Complete | 2026-08-01 |
| TASK-010 | Replace the client-side month lookup loop in `src/components/bills-groceries-dashboard.tsx` with `alignBillYearOverYear(data.months, data.bills.monthly, selectedBillId)` and map its integer-agorot output only at the Recharts presentation edge, then verify selected-Bill current/missing-prior values in `src/components/bills-groceries-dashboard.test.tsx`.           | Complete | 2026-08-01 |

### Implementation Phase 3

- GOAL-003: Make route identity and normalized query state impossible to diverge between the dashboard and detail routes.
- DEPENDENCIES: TASK-010 MUST be `Complete`; TASK-011 and TASK-014 may execute in parallel, TASK-012 and TASK-013 require TASK-011, TASK-015 requires TASK-013 and TASK-014, and TASK-016 requires TASK-012, TASK-013, and TASK-015.
- COMPLETION CRITERIA: Every generated chart detail link is accepted by the dynamic route, `year-over-year` is the sole YoY identity, and invalid or legacy detail queries redirect to the canonical detail URL before rendering.

| Task     | Description                                                                                                                                                                                                                                                                                                                                            | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| TASK-011 | Define one exported chart-ID tuple in `src/components/bills-groceries-dashboard.tsx`, derive `BillsGroceriesChartId` from it, replace every `yoy` chart identity and related identifier with `year-over-year`, and type `ChartCard.id` as `BillsGroceriesChartId`.                                                                                     | Complete | 2026-08-01 |
| TASK-012 | Delete the `detailHref` prop from `ChartCard`, derive non-detail links as `/bills-groceries/${id}${detailSuffix}`, and verify all four generated links use a member of the exported chart-ID tuple.                                                                                                                                                    | Complete | 2026-08-01 |
| TASK-013 | Replace the hand-written chart-ID set in `src/app/(app)/bills-groceries/[chart]/page.tsx` with the exported chart-ID tuple and verify `year-over-year` renders while `yoy` and unknown segments call `notFound()`.                                                                                                                                     | Complete | 2026-08-01 |
| TASK-014 | Add `canonicalBillsGroceriesParams()` to `src/lib/bills-groceries-page.ts`, apply it inside `loadBillsGroceriesPage()`, and return the canonical query alongside `data` and `selected` while preserving unrelated parameters and removing legacy daily-range parameters.                                                                               | Complete | 2026-08-01 |
| TASK-015 | Update `src/app/(app)/bills-groceries/page.tsx` and `src/app/(app)/bills-groceries/[chart]/page.tsx` to compare requested and canonical query strings and call `redirect()` with the correct dashboard or validated detail pathname before rendering.                                                                                                  | Complete | 2026-08-01 |
| TASK-016 | Extend `src/app/(app)/bills-groceries/page.test.tsx`, `src/app/(app)/bills-groceries/detail-pages.test.tsx`, and `src/components/bills-groceries-dashboard.test.tsx` with generated-link/route agreement, breaking `yoy` rejection, invalid detail month, legacy parameter removal, unrelated parameter preservation, and canonical no-redirect cases. | Complete | 2026-08-01 |

### Implementation Phase 4

- GOAL-004: Surface groceries-budget validation at the owned input without changing Settings persistence or layout.
- DEPENDENCIES: TASK-017 and TASK-018 may execute in parallel, TASK-019 requires TASK-018, and TASK-020 requires TASK-018 and TASK-019.
- COMPLETION CRITERIA: A server-rejected groceries budget produces `fieldErrors.groceriesBudget`, component markup associates and announces the exact error beside the Household-card input, error-triggered focus is implemented for Phase 5 browser proof, and valid set/clear behavior remains unchanged for both roles.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status  | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-017 | Parse the budget through a keyed Zod object in `src/app/actions/profile.ts` so `validationError()` returns `fieldErrors.groceriesBudget`, and verify invalid format, non-finite, non-positive, over-limit, and excessive-scale values in `src/app/actions/profile.test.ts`.                                                                                                                                                                                                                        | Complete | 2026-08-01 |
| TASK-018 | Refactor `src/components/settings-save-control.tsx` into a `SettingsForm` wrapper that remains the sole `useActionState(saveSettings)` owner, renders the existing `WorkspaceShell` and header controls unchanged, and exposes one React context provider and consumer hook for descendant Settings fields.                                                                                                                                                                                        | Complete | 2026-08-01 |
| TASK-019 | Convert `src/components/groceries-budget-settings-control.tsx` to consume the Settings action-state hook and render the existing input inside `Field` with a screen-reader label, adjacent `FieldError`, `aria-invalid`, `aria-describedby`, and error-triggered focus while preserving form IDs, names, initial values, dimensions, and native number constraints, then verify the error markup through the real context provider in `src/components/groceries-budget-settings-control.test.tsx`. | Complete | 2026-08-01 |
| TASK-020 | Update `src/app/(app)/settings/page.tsx` to use `SettingsForm` as the `WorkspaceShell` owner without moving the groceries budget from the Household card, and extend `src/app/(app)/settings/page.test.tsx` to verify the existing card structure and form ownership remain unchanged.                                                                                                                                                                                                             | Complete | 2026-08-01 |

### Implementation Phase 5

- GOAL-005: Verify the complete remediation with source, interaction, and regression evidence.
- DEPENDENCIES: TASK-001 through TASK-020 MUST be `Complete`; TASK-021, TASK-023, and TASK-024 may execute in parallel, and TASK-022 requires TASK-021.
- COMPLETION CRITERIA: Focused tests, the full suite, ESLint, diff checks, stale-symbol scans, and local browser flows pass; implementation evidence remains separate from hosted and production proof.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status  | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-021 | Run `bun run test -- src/lib/date-range.test.ts src/lib/bills-groceries.test.ts src/lib/bills-groceries-data.test.ts src/lib/validation.test.ts src/lib/financial-report.test.ts src/app/actions/profile.test.ts src/components/bills-groceries-dashboard.test.tsx src/components/groceries-budget-settings-control.test.tsx src/app/'(app)'/bills-groceries/page.test.tsx src/app/'(app)'/bills-groceries/detail-pages.test.tsx src/app/'(app)'/settings/page.test.tsx src/components/settings-save-control.test.ts` and record the exact passing counts. | Planned |      |
| TASK-022 | Run `bun run lint`, `bun run test`, and `git diff --check` without running `bun run build`, and record each result separately.                                                                                                                                                                                                                                                                                                                                                                                                                             | Planned |      |
| TASK-023 | Run stale scans for standalone `yoy`, `bills.yearOverYear`, removed local UTC helpers, hand-written detail paths, and unpaginated transaction reads, and verify every remaining match is intentional and documented.                                                                                                                                                                                                                                                                                                                                       | Planned |      |
| TASK-024 | In the local authenticated browser, verify all four dashboard detail controls, canonical redirects for invalid/legacy detail queries, Year-over-year selected-Bill current/missing-prior values, a server-rejected groceries budget with adjacent announced focusable error, and unchanged desktop/mobile Settings and navigation visuals.                                                                                                                                                                                                                 | Planned |      |

## 3. Alternatives

- **ALT-001**: Change only the broken link to `/bills-groceries/yoy`; rejected because the user requires `year-over-year` as the permanent route and chart identity.
- **ALT-002**: Increase the Supabase project row limit; rejected because it preserves silent truncation at a higher threshold and couples correctness to hosted configuration.
- **ALT-003**: Move analytics into a SQL aggregate RPC; rejected because bounded paginated reads are sufficient and an RPC would add a second implementation surface.
- **ALT-004**: Keep both server and client YoY projections; rejected because the server projection is unused and duplicates selected-Bill financial logic.
- **ALT-005**: Add a new calendar library or calendar service layer; rejected because the existing `date-range.ts` plus JavaScript UTC primitives cover the bounded shared arithmetic.
- **ALT-006**: Dispatch budget errors through DOM events or duplicate action state; rejected because one React context preserves one action-state owner and direct field association.
- **ALT-007**: Add `/yoy` compatibility redirects; rejected because breaking route changes are authorized and no persisted public route contract requires compatibility.

## 4. Dependencies

- **DEP-001**: Existing `@supabase/supabase-js` query builders provide `.select(..., { count: "exact" })`, `.order()`, and inclusive `.range()` modifiers.
- **DEP-002**: Existing `zod`, React 19, Next.js App Router, owned `Field`, `FieldError`, `Input`, and `WorkspaceShell` implementations provide all required validation, context, redirect, and accessibility primitives.
- **DEP-003**: `TASK-001` supplies the shared UTC functions consumed by `TASK-002` through `TASK-005`.
- **DEP-004**: `TASK-010` supplies the single selected-Bill YoY implementation before route identifiers change in Phase 3.
- **DEP-005**: No new package, database object, hosted mutation, or production change is required.

## 5. Files

- **FILE-001**: `docs/plans/bills-groceries-review-remediation.md` — source plan and task status.
- **FILE-002**: `src/lib/date-range.ts` and `src/lib/date-range.test.ts` — shared ISO/UTC calendar owner and edge-case tests.
- **FILE-003**: `src/lib/bills-groceries.ts` and `src/lib/bills-groceries.test.ts` — pure allocation, ranges, URL defaults, and single YoY alignment.
- **FILE-004**: `src/lib/bills-groceries-data.ts` and `src/lib/bills-groceries-data.test.ts` — complete paginated bounded reads and compact server projection.
- **FILE-005**: `src/lib/bills-groceries-page.ts` — shared canonical query construction.
- **FILE-006**: `src/lib/validation.ts`, `src/lib/validation.test.ts`, `src/lib/financial-report.ts`, and `src/lib/financial-report.test.ts` — consumers of shared UTC arithmetic.
- **FILE-007**: `src/components/bills-groceries-dashboard.tsx` and `src/components/bills-groceries-dashboard.test.tsx` — typed route identities, derived detail links, and selected-Bill YoY rendering.
- **FILE-008**: `src/app/(app)/bills-groceries/page.tsx`, `src/app/(app)/bills-groceries/[chart]/page.tsx`, `src/app/(app)/bills-groceries/page.test.tsx`, and `src/app/(app)/bills-groceries/detail-pages.test.tsx` — canonical dashboard/detail routing.
- **FILE-009**: `src/app/actions/profile.ts` and `src/app/actions/profile.test.ts` — keyed groceries-budget validation.
- **FILE-010**: `src/components/settings-save-control.tsx`, `src/components/settings-save-control.test.ts`, `src/components/groceries-budget-settings-control.tsx`, `src/components/groceries-budget-settings-control.test.tsx`, `src/app/(app)/settings/page.tsx`, and `src/app/(app)/settings/page.test.tsx` — shared Settings action state and accessible field error.

## 6. Testing

- **TEST-001**: Verify canonical real ISO dates, invalid dates, 2024-02-29, 2024-02/2026-02 month ends, December/January shifts, negative day shifts, and inclusive 365/366/367-day spans in `src/lib/date-range.test.ts`.
- **TEST-002**: Verify Bills proration preserves exact integer agorot, earliest-day remainders, post-allocation clipping, leap-day periods, rolling/calendar months, and Groceries daily zero filling after UTC consolidation.
- **TEST-003**: Verify each paginated stream aggregates rows from multiple pages when the first returned page is shorter than the requested range but the exact count is larger.
- **TEST-004**: Verify a later-page error and a zero-row no-progress response before the exact count is reached both surface `Unable to load BillsGroceries data.` without partial analytics.
- **TEST-005**: Verify changing the selected Bill calls the one pure YoY alignment path and renders current and missing previous values without a server `yearOverYear` field.
- **TEST-006**: Verify all generated detail hrefs are valid chart IDs, `/year-over-year` renders, `/yoy` returns not found, and dashboard/detail routes share identical canonical query output.
- **TEST-007**: Verify invalid `groceryMonth`, invalid Bill IDs, invalid period, and legacy `groceryFrom`/`groceryTo` redirect before detail rendering while unrelated parameters survive.
- **TEST-008**: Verify invalid groceries-budget submissions return and statically render the exact field message with `aria-invalid`, `aria-describedby`, and `FieldError`; verify valid set and clear still call the atomic RPC, and reserve actual focus movement for TASK-024 browser proof.
- **TEST-009**: Run the focused command in TASK-021, then full lint/tests and diff checks in TASK-022; do not run `bun run build`.
- **TEST-010**: Perform the browser flows in TASK-024 because links, redirects, focus, live error association, responsive layout, and chart interaction are not proven by source tests alone.

## 7. Risks & Assumptions

- **RISK-001**: Offset pagination can observe concurrent inserts or deletes between pages; stable `id` ordering and the exact count prevent row-limit truncation, while transaction-snapshot or cursor redesign remains out of scope until concurrent-write evidence justifies it.
- **RISK-002**: Exact counts add bounded database work to three chart reads; correctness takes precedence, and optimization requires measured query evidence before changing the contract.
- **RISK-003**: Moving Settings action state to a shared client ancestor can expand the client boundary; server-loaded Settings children MUST remain passed as opaque children and MUST NOT move Supabase reads into the client.
- **RISK-004**: UTC helper consolidation can accidentally change report policy; regression tests MUST compare outputs before deleting each local helper, and `localToday()` remains intentionally local-time policy.
- **RISK-005**: The breaking `yoy` removal invalidates manually bookmarked `/bills-groceries/yoy` URLs; the user explicitly authorized breaking changes and required one `year-over-year` identity.
- **ASSUMPTION-001**: The current Household-card groceries-budget placement and icon-only desktop/mobile navigation are approved and remain unchanged.
- **ASSUMPTION-002**: Existing transaction table grants and RLS already permit the current authenticated bounded reads; this plan changes neither grants nor policies.
- **ASSUMPTION-003**: The configured Supabase Data API returns an exact count for authenticated `select(..., { count: "exact" })` queries.

## 8. Related Specifications / Further Reading

- [`docs/plans/essentials-dashboard.md`](./essentials-dashboard.md)
- [`docs/architecture/bills-groceries-analytics.md`](../architecture/bills-groceries-analytics.md)
- [`docs/architecture/financial-model.md`](../architecture/financial-model.md)
- [`docs/design.md`](../design.md)
- [Supabase JavaScript `select()` reference](https://supabase.com/docs/reference/javascript/select)
- [Supabase JavaScript `range()` reference](https://supabase.com/docs/reference/javascript/using-modifiers-range)
- [Next.js `redirect()` reference](https://nextjs.org/docs/app/api-reference/functions/redirect)
