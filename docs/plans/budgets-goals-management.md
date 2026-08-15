---
goal: Add manual budget and savings-goal management
version: 1.0
date_created: 2026-08-15
last_updated: 2026-08-15
owner: Joint
status: "In progress"
tags: [feature, finance, budgets, goals, dashboard, supabase]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Add a combined Budgets & Goals management page, manual savings goals, a migrated Groceries budget, and a compact dashboard widget.

## 1. Requirements & Constraints

- **REQ-001**: Provide one `/budgets-goals` page containing stacked Budgets and Goals sections without tabs, toggles, or summary KPI cards.
- **REQ-002**: Allow one current recurring monthly budget on any active expense category or subcategory; parent and child budgets remain independent and are never aggregated together.
- **REQ-003**: Show every configured budget’s progress against the previous completed calendar month without a month picker.
- **REQ-004**: Store goals manually with name, target amount, current saved amount, and needed-by date.
- **REQ-005**: Calculate required monthly saving as `ceil(max(targetAgorot - savedAgorot, 0) / max(calendarMonthsUntilTarget, 1))`; define `calendarMonthsUntilTarget` from UTC ISO calendar months as `(targetYear - currentYear) * 12 + targetMonth - currentMonth`, using a minimum of `1` for a non-overdue target in the current month. A target date before today's UTC ISO date is overdue; completed goals require zero and overdue incomplete goals show `Overdue`.
- **REQ-006**: Keep completed goals in the Goals section until explicitly deleted.
- **REQ-007**: Replace the dashboard placeholder with two highest-utilization budget rows and the nearest incomplete goal; omit unavailable rows and show a concise empty state when none exist.
- **REQ-008**: Show only names, percentages, progress bars, and the Manage link directly in the widget; expose amounts, dates, and status details through hover/focus tooltips.
- **REQ-009**: Move the existing Groceries budget from Settings into the new page without losing its stored value or Bills & Groceries threshold behavior.
- **FIN-001**: Persist positive budget and target amounts and nonnegative saved amounts as finite ILS values with at most two decimal places and the existing upper bound.
- **FIN-002**: Permit saved amount to exceed target amount; cap the rendered bar at 100% while preserving the actual amount and completion state.
- **SEC-001**: Derive household scope from authenticated membership in every Server Action and reject cross-household category, subcategory, and goal identifiers.
- **SEC-002**: Protect `savings_goals` with household-scoped RLS and explicit authenticated grants; grant nothing to `anon` or `public`.
- **UI-001**: Reuse owned shadcn Card, Sheet, Field, Input, Progress, Tooltip, Button, and AlertDialog primitives with semantic tokens, visible focus, keyboard access, and 44px mobile controls.
- **UI-002**: Use native date input behavior and existing currency helpers; add no UI or date dependency.
- **CON-001**: Keep one current limit per target with no historical versions, allocation periods, goal contributions, transaction linkage, or automatic investment/savings derivation.
- **CON-002**: Do not build, push, deploy, apply a hosted migration, or mutate production as part of implementation without separate authorization.

## 2. Implementation Steps

### Implementation Phase 1 — Update product contracts

- **GOAL-001**: Authorize generalized category budgets and manual savings goals in durable documentation before behavior changes.

| Task     | Description                                                                                                                                                                                                                                                             | Status   | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-001 | Update `docs/design.md` with the approved combined page, progress-row, Sheet, tooltip, responsive, and dashboard-widget contracts and verify it no longer places Groceries budget in Settings.                                                                          | Complete | 2026-08-15 |
| TASK-002 | Update `docs/architecture/financial-model.md`, `docs/architecture/bills-groceries-analytics.md`, and `docs/roadmap.md` to define current recurring category/subcategory budgets and manual savings goals while retaining transaction-derived progress as deferred work. | Complete | 2026-08-15 |

### Implementation Phase 2 — Add persistence and domain rules

- **GOAL-002**: Persist the minimum budget and goal state while preserving existing Groceries data.

| Task     | Description                                                                                                                                                                                                                                  | Status   | Date       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-003 | Generate the `add_budgets_and_savings_goals` migration under `supabase/migrations/` and add nullable constrained `monthly_budget` columns to `categories` and `subcategories`.                                                               | Complete | 2026-08-15 |
| TASK-004 | Add migration validation preventing budgets on income categories or their subcategories and verify category-kind changes cannot leave an expense budget under an income parent.                                                              | Complete | 2026-08-15 |
| TASK-005 | Create `savings_goals` with household ownership, validated amounts and name, needed-by date, timestamps, household index, RLS policies, and explicit authenticated grants.                                                                   | Complete | 2026-08-15 |
| TASK-006 | Copy each `households.groceries_monthly_budget` value to the protected Groceries category, then remove the household column, constraint, and obsolete numeric `save_current_settings` overload only after migration assertions prove parity. | Complete | 2026-08-15 |
| TASK-007 | Regenerate `src/lib/database.types.ts` and verify only the planned budget, goal, and removed Settings contract fields change.                                                                                                                | Complete | 2026-08-15 |
| TASK-008 | Add `src/lib/budgets-goals.ts` with schemas, agorot-safe percentages, goal status, monthly-required calculation, deterministic urgency sorting, and focused unit tests.                                                                      | Complete | 2026-08-15 |

### Implementation Phase 3 — Add authenticated reads and mutations

- **GOAL-003**: Expose membership-scoped data and mutations without new API routes or read RPCs.

| Task     | Description                                                                                                                                                                                                          | Status   | Date       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-009 | Implement `getBudgetsGoalsData()` using existing category reads and two `dashboard_spending_breakdown` calls for parent and subcategory totals, then return all configured progress rows plus manually stored goals. | Complete | 2026-08-15 |
| TASK-010 | Implement `saveMonthlyBudget()` and `removeMonthlyBudget()` Server Actions that validate target kind, active expense ownership, amount, and household membership before updating the appropriate existing row.       | Complete | 2026-08-15 |
| TASK-011 | Implement `createSavingsGoal()`, `updateSavingsGoal()`, and `deleteSavingsGoal()` Server Actions with membership-derived household scope, field errors, and route revalidation.                                      | Complete | 2026-08-15 |
| TASK-012 | Update Bills & Groceries data loading to read the protected Groceries category’s `monthly_budget` while preserving the existing chart threshold line.                                                                | Planned  |            |
| TASK-013 | Remove Groceries budget fields, dirty-state plumbing, validation, and save arguments from Settings and delete the unused control after caller tests pass.                                                            | Planned  |            |

### Implementation Phase 4 — Build the approved interfaces

- **GOAL-004**: Deliver the configuration-first page, navigation destination, and compact dashboard widget.

| Task     | Description                                                                                                                                                                                                         | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-014 | Add `/budgets-goals` with local loading UI and two stacked Cards that list every budget and goal progress row with exact accessible text alternatives.                                                              | Planned |      |
| TASK-015 | Add budget creation and editing Sheets that group active expense parents and subcategories, exclude already-budgeted targets when adding, and clear budgets through AlertDialog confirmation.                       | Planned |      |
| TASK-016 | Add goal creation and update Sheets with name, target, saved amount, native needed-by date, inline validation, calculated monthly requirement, and confirmed deletion.                                              | Planned |      |
| TASK-017 | Add Budgets & Goals to desktop and five-item mobile navigation using the approved Target icon and update active-route tests.                                                                                        | Planned |      |
| TASK-018 | Replace `BudgetsPlaceholder` and its loading state with a compact widget showing the two highest `spent / limit` budget ratios and nearest incomplete goal, with deterministic ties and capped bars.                | Planned |      |
| TASK-019 | Add focusable 44px tooltip triggers whose accessible labels expose spent/limit, saved/target, needed-by date, monthly requirement, completion, overdue, and over-budget details without permanent explanatory copy. | Planned |      |

### Implementation Phase 5 — Verify and close the plan

- **GOAL-005**: Prove data migration, authorization, financial calculations, and approved responsive behavior.

| Task     | Description                                                                                                                                                                                                                    | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| TASK-020 | Add migration pgTAP coverage for Groceries value preservation, budget constraints, goal constraints, grants, RLS membership access, and cross-household isolation.                                                             | Planned |      |
| TASK-021 | Add action and read-model tests for parent and subcategory budgets, overlapping independent rows, set/remove flows, goal CRUD, completed/overdue calculations, and unauthorized identifiers.                                   | Planned |      |
| TASK-022 | Add component tests proving both sections render simultaneously without tabs, all progress rows remain visible, the widget exposes only approved visible copy, and tooltip details work by hover and focus.                    | Planned |      |
| TASK-023 | Run `bun run format:check && bun run lint && bun run typecheck && bun run test` and keep the plan incomplete until all relevant checks pass.                                                                                   | Planned |      |
| TASK-024 | After explicit hosted-write authorization, verify `joint-dev` project ref `magcvzqnwrwxkhtsfspg`, run migration list and dry-run, apply through the linked CLI, recheck history, types, pgTAP, catalog behavior, and advisors. | Planned |      |
| TASK-025 | Verify authenticated desktop and mobile flows for add/edit/remove, keyboard tooltips, empty states, completed and overdue goals, over-budget rows, Bills threshold parity, dashboard rendering, and horizontal overflow.       | Planned |      |

## 3. Alternatives

- **ALT-001**: Use dated budget records; rejected because the approved first version uses one current editable limit and does not preserve historical limits.
- **ALT-002**: Create a polymorphic budgets table; rejected because budget columns on existing category and subcategory rows enforce one limit per target with less schema and mutation code.
- **ALT-003**: Aggregate parent and child budgets into one widget percentage; rejected because overlapping spending would be counted twice.
- **ALT-004**: Derive goals from transactions; deferred until an investment/savings transaction type and allocation contract are approved.
- **ALT-005**: Split Budgets and Goals into tabs or dashboard-style pages; rejected by the approved combined configuration-first design.

## 4. Dependencies

- **DEP-001**: Existing category/subcategory ownership, transaction links, `dashboard_spending_breakdown`, currency helpers, and membership context remain authoritative.
- **DEP-002**: Existing owned shadcn primitives cover the complete UI; no package installation is required.
- **DEP-003**: Applying and proving the migration requires authenticated linked CLI access to `joint-dev` and explicit user authorization.
- **DEP-004**: Phase 2 depends on Phase 1 contract approval; Phases 3–4 depend on generated Phase 2 types; Phase 5 depends on all implementation phases.

## 5. Files

- **FILE-001**: `docs/design.md`, `docs/architecture/financial-model.md`, `docs/architecture/bills-groceries-analytics.md`, `docs/roadmap.md`, and `docs/plans/budgets-goals-management.md` — product contracts and source plan.
- **FILE-002**: The generated Supabase migration and `src/lib/database.types.ts` — budget columns, goals persistence, RLS, grants, and Groceries migration.
- **FILE-003**: `src/lib/budgets-goals.ts` and related tests — domain calculations, read model, sorting, and validation.
- **FILE-004**: `src/app/(app)/budgets-goals/`, its Server Actions, and focused components — management page and mutation flows.
- **FILE-005**: Dashboard, workspace navigation, Settings, and Bills & Groceries files — widget replacement, route access, old-control removal, and threshold compatibility.

## 6. Testing

- **TEST-001**: Budget tests cover parent/direct and subcategory targets, percentage calculation, over-budget state, zero spending, removal, archive filtering, and overlapping independent limits.
- **TEST-002**: Goal tests cover validation, rounding up monthly requirements, same-month targets, future months, completed targets, overfunding, overdue dates, updates, and deletion.
- **TEST-003**: Authorization tests prove members can manage only their household’s budgets and goals and that anonymous or cross-household access fails.
- **TEST-004**: Migration tests prove the existing Groceries amount moves exactly once and the Bills & Groceries threshold remains unchanged.
- **TEST-005**: UI tests prove the page has no internal mode switch, lists all progress bars, uses accessible Sheets/dialogs/tooltips, and maintains 44px mobile targets.
- **TEST-006**: Dashboard tests prove the two highest-utilization budgets and nearest incomplete goal render deterministically without double-counting.
- **TEST-007**: Authenticated browser checks cover desktop/mobile layout, keyboard operation, tooltips, mutations, empty/error states, and no overflow.
- **TEST-008**: Full formatting, lint, typecheck, and test suites pass; no production build runs unless separately requested.

## 7. Risks & Assumptions

- **RISK-001**: Parent and child budgets can overlap; the UI must state their level and never present an aggregate total.
- **RISK-002**: Editing a current limit changes how any previously selected month is evaluated because historical limit versions are intentionally absent.
- **RISK-003**: Dropping the household Groceries field can lose the existing threshold if migration-copy assertions are incomplete, so removal occurs only after parity verification.
- **ASSUMPTION-001**: The management page evaluates the previous completed month, matching Joint’s monthly-retro dashboard behavior.
- **ASSUMPTION-002**: The dashboard’s budget rows use its selected date range, while goal progress remains the current manually entered state.
- **ASSUMPTION-003**: Budget urgency sorts by uncapped `spent / limit` descending; ties sort by target label and stable ID.
- **ASSUMPTION-004**: Incomplete and overdue goals sort by needed-by date before completed goals; completed goals remain until deletion.
- **ASSUMPTION-005**: No branch, push, deployment, production mutation, or hosted development migration is authorized by this plan alone.

## 8. Related Specifications / Further Reading

- `docs/design.md`
- `docs/architecture/financial-model.md`
- `docs/roadmap.md`
- `docs/plans/shared-budget-mvp.md`
- `docs/plans/essentials-dashboard.md`
- Approved visual: `/Users/yonatan/.codex/visualizations/2026/08/15/01a00453-9adc-76a1-962d-2af3d59788fa/budgets-goals-concept.html`
