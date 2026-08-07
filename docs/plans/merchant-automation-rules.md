---
goal: Add ordered merchant automation rules for normalization and category assignment
version: 1.0
date_created: 2026-08-07
last_updated: 2026-08-07
owner: Joint
status: "In progress"
tags: [feature, automation, transactions, imports, supabase]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Implement household-owned, ordered merchant rules. Each atomic rule either normalizes a merchant or assigns a transaction destination. Rules affect new manual and statement-import transactions; existing transactions require preview and explicit confirmation.

## 1. Requirements & Constraints

- **REQ-001**: Add `/automations`, linked from Settings, with accessible list, create, edit, enable, delete, and drag/keyboard reorder behavior.
- **REQ-002**: Support only `normalize_merchant` and `assign_category`; future actions require a separate approved migration and plan.
- **REQ-003**: Evaluate RE2-compatible patterns case-insensitively against the original trimmed merchant; first enabled match per action wins by persisted order.
- **REQ-004**: Preserve an explicit manual destination; a blank manual destination resolves through the category rule or retains the current validation error.
- **REQ-005**: Apply rules while creating manual and statement-import transactions, never implicitly on edit, and bulk-apply existing rows only after preview and confirmation.
- **SEC-001**: Derive household identity server-side, use household RLS, use linear-time RE2 matching, and make confirmed bulk changes atomic.
- **CON-001**: Use a generated forward migration, verified `joint-dev`, generated database types, focused/full tests, lint, formatting, and browser proof; do not run `bun run build` unless requested.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Establish the approved contract and visual surface.

| Task     | Description                                                                                                                                     | Status   | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-001 | Update `docs/design.md` and create the visual-only `/automations` workspace with list, action forms, conflict preview, and confirmation states. | Complete | 2026-08-07 |
| TASK-002 | Add the exact RE2 and accessible sortable-list dependencies and verify the lockfile scope.                                                      | Complete | 2026-08-07 |

### Implementation Phase 2

- **GOAL-002**: Add protected persistence and atomic database operations.

| Task     | Description                                                                                                                                 | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-003 | Create the generated `add_merchant_automation_rules` migration with RLS, validated payloads, order and bulk-apply RPCs, and pgTAP coverage. | Complete | 2026-08-07 |
| TASK-004 | Apply and verify the migration only after the required `joint-dev` preflight, dry-run, writer check, type generation, and advisor checks.   | Complete | 2026-08-07 |

### Implementation Phase 3

- **GOAL-003**: Implement deterministic evaluation and authenticated management actions.

| Task     | Description                                                                                                                                          | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-005 | Add the tested merchant automation engine, exact-count page reader, CRUD/reorder actions, preview fingerprint, and confirmed atomic application.     | Complete | 2026-08-07 |
| TASK-006 | Update transaction creation and statement import so rules run once before their existing inserts without changing edit behavior or import atomicity. | Complete | 2026-08-07 |

### Implementation Phase 4

- **GOAL-004**: Connect the approved UI and prove the complete behavior.

| Task     | Description                                                                                                                          | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| TASK-007 | Connect `/automations`, Settings navigation, accessible sorting, rule forms, conflict preview, and explicit bulk-apply confirmation. | Complete | 2026-08-07 |
| TASK-008 | Run focused/full tests, lint, format check, pgTAP, browser workflows, update architecture documentation, and commit intended files.  | Blocked  | 2026-08-07 |

## 3. Alternatives

- **ALT-001**: A sequential pipeline was rejected because normalization would silently change later rule matches.
- **ALT-002**: Database-trigger matching was rejected because it would diverge from UI preview semantics.
- **ALT-003**: Generic JSON automations were rejected because only two concrete actions are approved.

## 4. Dependencies

- **DEP-001**: `re2js@2.8.5` for safe user-authored matching.
- **DEP-002**: `@dnd-kit/react@0.5.0` and `@dnd-kit/helpers@0.5.0` for accessible sorting.
- **DEP-003**: Explicit authorization and exclusive writer access for hosted `joint-dev` migration work.

## 5. Files

- **FILE-001**: `supabase/migrations/<generated>_add_merchant_automation_rules.sql` and `supabase/tests/shared_balance.sql`.
- **FILE-002**: `src/lib/merchant-automations.ts`, `src/app/actions/merchant-automations.ts`, and focused tests.
- **FILE-003**: `src/app/(app)/automations/page.tsx`, `src/components/automation-rules-workspace.tsx`, and Settings/transaction/import integration.
- **FILE-004**: `docs/design.md` and `docs/architecture/financial-model.md`.

## 6. Testing

- **TEST-001**: Pure engine tests cover Hebrew patterns, ordering, conflicts, disabled rules, literal normalization, and invalid RE2 syntax.
- **TEST-002**: Action and database tests cover RLS, payload/destination validation, reordering, stale preview rejection, and atomic bulk application.
- **TEST-003**: Transaction/import tests cover explicit destination precedence, automatic blank resolution, normalization, and import idempotency.
- **TEST-004**: Browser checks cover rule management, pointer and keyboard sorting, real forms, preview/confirmation, manual entry, and import.

## 7. Risks & Assumptions

- **RISK-001**: Future regex overlap cannot be proven generally; current-data previews and visible ordered precedence mitigate it.
- **RISK-002**: Rules must never auto-assign Bills because their service periods cannot be inferred.
- **ASSUMPTION-001**: Existing category rules affect only uncategorized rows; normalization may affect any matching merchant after confirmation.
- **ASSUMPTION-002**: Both household members manage the shared ordered rule list.

## 8. Related Specifications / Further Reading

- [Joint design system](../design.md)
- [Financial model](../architecture/financial-model.md)
- [Statement import plan](transactions-statement-import.md)
- [RE2 syntax](https://github.com/google/re2/wiki/syntax)
- [dnd-kit accessibility](https://docs.dndkit.com/guides/accessibility)
