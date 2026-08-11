---
goal: Remediate current-branch correctness, architecture, debt, and verification gaps before merging to main
version: 1.0
date_created: 2026-08-11
last_updated: 2026-08-12
owner: Joint maintainers
status: In progress
tags: [bug, architecture, security, cleanup, dashboard, supabase]
---

# Introduction

![Status: In%20progress](https://img.shields.io/badge/status-In%20progress-yellow)

Create `docs/plans/progressive-web-app-review-remediation.md` to remediate the verified `fded418..a1cdd1c` branch gaps. Fresh local format, lint, typecheck, and 544 tests pass; the remaining work concerns behavioral contracts, schema compatibility, generated-type drift, unnecessary dashboard reads, and independent-review evidence.

## 1. Requirements & Constraints

- **REQ-001**: Rename the dashboard membership fallback card from `Shared balance` to `Monthly balance`.
- **REQ-002**: Give the six-month Income, Outgoings, and Monthly balance lines distinct solid, dashed, and dotted stroke patterns.
- **REQ-003**: Render Bills and year-over-year legends independently and preserve the desktop legend for every non-empty Bills selection.
- **REQ-004**: Replace custom-range balance fanout with one database-produced `balance_change_percentage`.
- **REQ-005**: Replace per-category spending RPC fanout with one `dashboard_spending_breakdown` call accepting validated category IDs and a subcategory flag.
- **REQ-006**: Move donut geometry behind `DashboardSpendingDonut` so its interface accepts values rather than precomputed SVG paths.
- **REQ-007**: Remove unused dashboard activity/category-change adapters and projections after migration-first compatibility is established.
- **SEC-001**: Every dashboard function must remain `SECURITY INVOKER`, use an empty `search_path`, derive membership through `auth.uid()`, and grant execution only to `authenticated`.
- **SEC-002**: Invalid, archived, income, or cross-household category IDs must not select data; when no eligible requested ID remains, preserve the all-category fallback.
- **SEC-003**: Complete a canonical whole-repository Standard security scan before completion; the source inspection found no validated vulnerability, but the independent scan artifact was blocked.
- **CON-001**: Do not edit migrations already applied to `joint-dev`; create forward migrations only.
- **CON-002**: Use two production releases because pending migrations remove functions used by the currently deployed app.
- **CON-003**: Do not branch, push, deploy, or mutate `joint-dev` or production without explicit approval.
- **CON-004**: Preserve persistent workspace chrome, financial semantics, URL-backed selections, approved UI, and unrelated work.
- **CON-005**: Add no dependency and do not run `bun run build` unless separately requested.

## 2. Implementation Steps

### Implementation Phase 1 — Deploy the schema-transition shim

- **GOAL-001**: Make the currently deployed dashboard tolerate the branch’s migration-first removal of old projections.

| Task     | Description                                                                                                                                                                                                                                                                                                         | Status                                                  | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| TASK-001 | On a user-selected branch based on `origin/main`, make `src/lib/dashboard-read-model.ts` recognize only `PGRST202` or `42883` missing-function errors from `dashboard_spending`, `dashboard_balance`, and `dashboard_recent_activity`, and return an explicit `schema_transition` result verified by focused tests. | Blocked — requires the separate app-only release branch | 2026-08-12 |
| TASK-002 | Update the corresponding dashboard cards in `src/app/(app)/page.tsx` to render neutral `Updating dashboard…` content for `schema_transition` results while preserving every other error as a failed request.                                                                                                        | Blocked — depends on TASK-001's app-only release        | 2026-08-12 |
| TASK-003 | Run focused dashboard tests and the full local validation suite, then release this app-only compatibility change before any feature-branch migration is allowed to reach production.                                                                                                                                | Blocked — production release authorization required     | 2026-08-11 |

### Implementation Phase 2 — Correct visible and accessible regressions

- **GOAL-002**: Restore the approved dashboard and chart contracts with the smallest UI diff.

| Task     | Description                                                                                                                                                                                                                                                   | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-004 | Change `DashboardMembershipFallback` and its test to use `Monthly balance`, requiring the pending and resolved dashboard card labels to match.                                                                                                                | Complete | 2026-08-12 |
| TASK-005 | Set Outgoings to `strokeDasharray="6 4"` and Monthly balance to `strokeDasharray="2 4"` in `DashboardMonthlyTrend`, leaving Income solid and asserting all three patterns through the Recharts mock.                                                          | Complete | 2026-08-12 |
| TASK-006 | Remove the ten-item legend cap from the Bills chart, render the year-over-year legend unconditionally when that chart exists, and add an eleven-Bill regression proving both desktop legends remain available while the Bills legend stays hidden below `md`. | Complete | 2026-08-12 |

### Implementation Phase 3 — Deepen and shrink dashboard reads

- **GOAL-003**: Concentrate dashboard aggregation behind one database seam and delete branch-introduced dead paths.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                         | Status      | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| TASK-007 | Create `supabase/migrations/*_dashboard_review_read_remediation.sql` with `supabase migration new dashboard_review_read_remediation`, adding `balance_change_percentage` to `dashboard_summary`, creating `dashboard_spending_breakdown(date,date,date,uuid[],boolean)`, and dropping the obsolete four-argument spending, activity, and category-change functions. | In progress | 2026-08-12 |
| TASK-008 | Implement `dashboard_spending_breakdown` so category mode returns selected parent totals and subcategory mode returns selected eligible-parent children in one query, with null or wholly ineligible selections falling back to all eligible categories.                                                                                                            | In progress | 2026-08-12 |
| TASK-009 | Update `src/lib/dashboard-read-model.ts` and `src/app/(app)/page.tsx` to consume one spending-breakdown call and the summary-provided balance comparison, then delete `getDashboardRecentActivity`, `previousThreeDateRanges`, the singular spending-category option, fanout orchestration, and their obsolete tests.                                               | Complete    | 2026-08-12 |
| TASK-010 | Change `DashboardSpendingDonut` to accept numeric segments and calculate total angles and paths internally, requiring single- and multi-segment tests to exercise its public interface.                                                                                                                                                                             | Complete    | 2026-08-12 |
| TASK-011 | Extend `supabase/tests/dashboard_read_projections.sql` to verify balance comparison, selected parent aggregation, selected subcategory aggregation, all-category fallback, tenant isolation, function privileges, and absence of dropped projections.                                                                                                               | In progress | 2026-08-12 |

### Implementation Phase 4 — Prove schema, compatibility, and release readiness

- **GOAL-004**: Verify local behavior, approved hosted development schema, browser behavior, and independent review before integration.

| Task     | Description                                                                                                                                                                                                                                                                              | Status                                                              | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| TASK-012 | After confirming `supabase/.temp/project-ref` is `magcvzqnwrwxkhtsfspg` and receiving writer approval, run linked history, dry-run, push, history recheck, pgTAP, advisors, and catalog checks against `joint-dev`.                                                                      | Blocked — joint-dev mutation and exclusive-writer approval required | 2026-08-11 |
| TASK-013 | Regenerate `src/lib/database.types.ts` from the migrated schema and require it to contain the new breakdown and balance fields while omitting `dashboard_balance`, `dashboard_spending`, `dashboard_recent_activity`, `dashboard_category_changes`, and monthly-review `shared_balance`. | Blocked — requires migrated `joint-dev` schema                      | 2026-08-12 |
| TASK-014 | Run focused tests, `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, and `git diff --check`, requiring every command to exit successfully.                                                                                                                    | Complete                                                            | 2026-08-12 |
| TASK-015 | Verify authenticated desktop/mobile dashboard loading, category and subcategory selection, custom-range comparisons, trend strokes, eleven-Bill legends, back/forward URL behavior, and a clean browser console.                                                                         | Blocked — authenticated browser verification required               | 2026-08-12 |
| TASK-016 | Repeat correctness, architecture, ponytail, and canonical whole-repository security reviews after the encrypted subagent transport is restored, requiring no unresolved P0–P2 or medium-and-higher security finding.                                                                     | Blocked — release/type gaps and two medium security findings        | 2026-08-12 |
| TASK-017 | Release the schema and final application only after TASK-003 and TASK-012 through TASK-016 pass, keeping all production actions under explicit user control.                                                                                                                             | Blocked — production release authorization required                 | 2026-08-11 |

## 3. Alternatives

- **ALT-001**: Keep a single migration-first release; rejected because the deployed app calls functions removed before the replacement app starts.
- **ALT-002**: Hide the spending fanout inside the TypeScript adapter; rejected because it moves complexity without reducing database round trips.
- **ALT-003**: Keep the current RPC and fanout in the page; rejected by the selected one-RPC architecture.
- **ALT-004**: Add a generic chart geometry framework; rejected because the donut needs only one local numeric-to-path implementation.
- **ALT-005**: Retain unused projections for hypothetical reuse; rejected because migration history can restore them when a real caller exists.

## 4. Dependencies

- **DEP-001**: Release 1 must land before the feature branch’s migrations can reach production.
- **DEP-002**: Supabase applies pending migrations in timestamp order and records each successful migration, so rollout compatibility cannot rely on a later migration running first. [Supabase migration documentation](https://supabase.com/docs/guides/deployment/database-migrations)
- **DEP-003**: Bun, Vitest, Supabase CLI, authenticated `joint-dev`, and in-app browser access.
- **DEP-004**: Explicit approval is required separately for branch integration, `joint-dev` mutation, and each production release.

## 5. Files

- **FILE-001**: `docs/plans/progressive-web-app-review-remediation.md` records this plan and execution evidence.
- **FILE-002**: `src/app/(app)/page.tsx` loses fanout and custom comparison orchestration.
- **FILE-003**: `src/lib/dashboard-read-model.ts` becomes the single dashboard read adapter.
- **FILE-004**: `src/components/dashboard-monthly-trend.tsx`, `dashboard-spending-donut.tsx`, and `bills-groceries-dashboard.tsx` receive the focused presentation fixes.
- **FILE-005**: `src/app/(app)/dashboard-loading.tsx` receives the corrected pending-card label.
- **FILE-006**: The new forward migration and `supabase/tests/dashboard_read_projections.sql` define and prove the final database interface.
- **FILE-007**: `src/lib/database.types.ts` is regenerated, never hand-edited.

## 6. Testing

- **TEST-001**: The transition shim distinguishes missing projection functions from real database, authentication, and authorization failures.
- **TEST-002**: Pending and resolved metric cards both expose `Monthly balance`.
- **TEST-003**: Trend tests assert one solid, one dashed, and one dotted series plus the existing legend, tooltip, accessibility layer, and equivalent table.
- **TEST-004**: Eleven selected Bills retain the desktop Bills legend and the independent year-over-year legend without reintroducing mobile overflow.
- **TEST-005**: One spending RPC returns correct parent and child totals for null, valid, invalid, archived, and cross-household selections.
- **TEST-006**: Custom-range balance comparison uses the same eligible prior-range history as income and outgoings.
- **TEST-007**: Generated types exactly match the final hosted development schema.
- **TEST-008**: Full local validation remains at least 78 passing files and 544 passing tests with no formatting, lint, type, or whitespace failure.
- **TEST-009**: Authenticated browser verification covers desktop, mobile, custom range, category fanout replacement, loading, navigation history, and console errors.

## 7. Risks & Assumptions

- **RISK-001**: Release 1 intentionally carries temporary schema-transition handling; remove it in Release 2 after the final adapters no longer call old projections.
- **RISK-002**: Replacing the spending function can change historical archived-subcategory reporting; preserve existing transaction inclusion and use active subcategories only to determine selector eligibility.
- **RISK-003**: Static Recharts tests cannot prove layout; authenticated desktop/mobile verification remains mandatory.
- **RISK-004**: The four requested subagents, including authorized Sol fallbacks, all failed with encrypted-output transport errors; the consolidated findings are parent-validated but lack independent reviewer evidence.
- **RISK-005**: Plan Mode prevented the architecture HTML report and canonical security artifacts from being written; TASK-016 closes both evidence gaps.
- **ASSUMPTION-001**: No validated security vulnerability exists in the inspected current source; membership-derived identifiers, RLS, `SECURITY INVOKER`, and authenticated-only grants remain intact.
- **ASSUMPTION-002**: Invalid or wholly ineligible category selections continue to mean all eligible categories.
- **ASSUMPTION-003**: No dependency, new product behavior, build command, or production mutation is required to implement the code changes.

## 8. Related Specifications / Further Reading

- [Dashboard monthly review design](docs/plans/dashboard-monthly-review-design.md)
- [Application runtime](docs/architecture/application-runtime.md)
- [Bills & Groceries analytics](docs/architecture/bills-groceries-analytics.md)
- [Joint design contract](docs/design.md)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## 9. Execution Evidence

- **EVID-001**: Local `bun run format:check`, `bun run lint`, `bun run typecheck`, `bun run test`, and `git diff --check` passed on 2026-08-12; Vitest reported 78 files and 544 tests passing.
- **EVID-002**: The focused pgTAP suite now contains 15 assertions, but execution is blocked because the local Postgres container is unavailable and linked `joint-dev` mutation requires approval.
- **EVID-003**: Independent correctness, architecture, debt, and whole-repository security reviews ran after subagent transport recovery. Architecture evidence: `/tmp/architecture-review-joint-dashboard-remediation.html`.
- **EVID-004**: Release 1 remains required before migration release: the current deployed app calls projections removed by pending migrations, while the final app calls the new breakdown projection. Generated database types remain intentionally unmodified until a migrated schema can generate them.
- **EVID-005**: The whole-repository scan found two medium pre-existing resource-exhaustion findings: unbounded recurring-schedule catch-up (CWE-400) and compressed XLSX workbook decompression/traversal (CWE-409). They require separately authorized remediation before TASK-016 can pass.
