---
goal: Correct current-branch defects and deepen automation, transaction-draft, and Bills & Groceries modules
version: 1.0
date_created: 2026-08-08
last_updated: 2026-08-08
owner: Joint maintainers
status: "In progress"
tags: [bug, refactor, architecture, automation, transactions, analytics, supabase]
---

# Current Branch Correctness and Architecture Remediation

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Correct the verified current-branch defects, then deepen the automation-condition, transaction-draft, and Bills & Groceries navigation modules without changing persisted shapes, routes, financial semantics, or the approved UI.

## 1. Requirements & Constraints

- **REQ-001**: Permit validated RE2 `Matches regex` conditions for both Merchant and Note.
- **REQ-002**: Preserve AND/OR connector positions when condition rows are reordered or removed.
- **REQ-003**: Make transaction-kind changes clear category, subcategory, and Bills-period state permanently.
- **REQ-004**: Deepen automation conditions, transaction drafts, and Bills & Groceries navigation without changing their persisted shapes, routes, Server Action fields, or approved UI.
- **SEC-001**: Add a forward migration; never edit an applied migration.
- **CON-001**: Keep `period` and `groceryMonth` server-backed; keep `bills`, `bill`, and `grocery` presentation-only.
- **CON-002**: Preserve unknown and repeated URL parameters, browser back/forward behavior, financial invariants, DOM structure, classes, accessibility, and responsive layout.
- **CON-003**: Stay on the selected branch; do not build, push, deploy, or mutate production.
- **CON-004**: Apply the migration to `joint-dev` only after explicit approval, project-ref confirmation, exclusive-writer confirmation, migration-history review, and dry-run.

## 2. Implementation Steps

### Implementation Phase 1 — Correctness and database parity

- **GOAL-001**: Fix the three verified defects before structural refactoring.

| Task     | Description                                                                                                                                                                                                                      | Status   | Date       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-001 | Replace the pgTAP Note-regex rejection with a failing acceptance assertion and add regressions for fixed-position connectors and direct-category kind switching.                                                                 | Complete | 2026-08-08 |
| TASK-002 | Generate `allow_note_regex_automation_conditions`, replace the current validator through a forward migration, permit `advanced` for Merchant and Note, and retain every existing field, length, connector, and amount invariant. | Complete | 2026-08-08 |
| TASK-003 | Change condition reordering to reassign the pre-move connector sequence by position, proving `A AND B OR C` reordered to `C, A, B` becomes `C AND A OR B`.                                                                       | Complete | 2026-08-08 |
| TASK-004 | Clear both category identifiers and the Bills period on transaction-kind changes, including an expense-to-income-to-expense round-trip regression.                                                                               | Complete | 2026-08-08 |
| TASK-005 | Run focused Vitest, disposable local pgTAP, lint, TypeScript, formatting, and whitespace checks before committing Phase 1.                                                                                                       | Blocked  | 2026-08-08 |

TASK-005 is blocked only on disposable local pgTAP: a fresh `supabase start` fails before this phase's migration because `20260716095300_revoke_rls_auto_enable_execute.sql` revokes a function that is absent until a later historical recovery migration. Focused Vitest, ESLint, TypeScript, Prettier, and whitespace checks pass; applied migration history remains untouched.

### Implementation Phase 2 — Deepen the automation-condition module

- **GOAL-002**: Make one TypeScript module own condition parsing, canonicalization, evaluation, descriptions, and connector transitions.

| Task     | Description                                                                                                                                                                             | Status  | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-006 | Move the condition-group Zod schema and RE2 validation from the Server Action into `src/lib/automation-conditions.ts`, exposing a typed parse result with field-level errors.           | Planned |      |
| TASK-007 | Add `preserveConditionConnectorPositions(previous, reordered)` to the condition module and make the editor consume it rather than owning connector semantics.                           | Planned |      |
| TASK-008 | Remove the duplicate runtime guard, unused encoded JSON result, dead group-level option list, and obsolete tests while retaining legacy group-level decoding.                           | Planned |      |
| TASK-009 | Add table-driven parity tests covering Merchant and Note literal/regex conditions, amount operators, legacy logic, per-row connectors, invalid RE2, limits, and compatibility patterns. | Planned |      |
| TASK-010 | Run focused automation tests, lint, TypeScript, formatting, and whitespace checks before committing Phase 2.                                                                            | Planned |      |

### Implementation Phase 3 — Deepen transaction-draft state

- **GOAL-003**: Concentrate transaction form transitions and canonical submission fields in a pure module.

| Task     | Description                                                                                                                                                                                                   | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-011 | Add `src/lib/transaction-draft.ts` with `TransactionDraft`, discriminated destination state, draft events, initialization, reducer, and canonical form-field projection.                                      | Planned |      |
| TASK-012 | Define events for kind, destination, date, payer, and service-period changes; make kind changes clear destination and period, Bills selection initialize a same-day period, and non-Bills selection clear it. | Planned |      |
| TASK-013 | Replace related `TransactionSheet` state setters and hidden-field derivation with the draft reducer while leaving calendar-popover visibility local to the Sheet.                                             | Planned |      |
| TASK-014 | Add pure transition tests and retain component assertions for edit/import initialization, eligible destinations, payer defaults, date handling, Bills bounds, and unchanged markup order.                     | Planned |      |
| TASK-015 | Run transaction validation/action/component tests, lint, TypeScript, formatting, and whitespace checks before committing Phase 3.                                                                             | Planned |      |

### Implementation Phase 4 — Deepen Bills & Groceries navigation

- **GOAL-004**: Centralize URL-state derivation and navigation policy without redesigning chart rendering or data access.

| Task     | Description                                                                                                                                                                                                     | Status  | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-016 | Add `src/lib/bills-groceries-navigation.ts` with owned URL-key types, presentation-state parsing, URL construction, and `data` versus `presentation` navigation classification.                                 | Planned |      |
| TASK-017 | Classify any update containing `period` or `groceryMonth` as `data`; classify updates limited to `bills`, `bill`, or `grocery` as `presentation`; preserve unrelated and repeated parameters in both paths.     | Planned |      |
| TASK-018 | Replace the dashboard’s separate navigation helpers and inline selection parsing with the navigation module, using `router.push` for data updates and native `history.pushState` for presentation updates.      | Planned |      |
| TASK-019 | Keep canonical redirects and `getBillsGroceriesData` unchanged, and retain the existing chart, table, detail-route, and accessibility markup in the dashboard module.                                           | Planned |      |
| TASK-020 | Test URL classification, invalid-selection fallbacks, detail links, unknown parameters, back/forward synchronization, and absence of server navigation for presentation-only changes before committing Phase 4. | Planned |      |

### Implementation Phase 5 — Cleanup, hosted proof, and completion

- **GOAL-005**: Remove verified shallow code and prove the complete branch locally and on approved `joint-dev`.

| Task     | Description                                                                                                                                                                                                                         | Status  | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-021 | Inline test-only animation and legend constants where still single-use, remove exact implementation-value assertions, and record the verified net line reduction.                                                                   | Planned |      |
| TASK-022 | Confirm `supabase/.temp/project-ref` equals `magcvzqnwrwxkhtsfspg`, obtain writer and mutation approval, then run linked history, dry-run, push, history recheck, catalog verification, advisors, and type regeneration.            | Planned |      |
| TASK-023 | Run authenticated browser workflows for Note regex create/edit/preview, mixed-connector pointer and keyboard reorder, transaction kind round-trip, and Bills & Groceries data/presentation navigation at desktop and mobile widths. | Planned |      |
| TASK-024 | Run full Vitest, ESLint, TypeScript, Prettier check, pgTAP, migration lint, generated-type comparison, and `git diff --check`; do not run `bun run build`.                                                                          | Planned |      |
| TASK-025 | Update durable architecture documentation, reconcile Tasks 015–016 in the merchant plan with actual evidence, and mark this source plan complete only after every required check passes.                                            | Planned |      |
| TASK-026 | Perform a final read-only review of the complete range; if the mandated delegated reviewer model remains unavailable, report the review gap without substituting another model.                                                     | Planned |      |

## 3. Alternatives

- **ALT-001**: Apply only the three minimal fixes; rejected because the selected scope includes all reviewed architecture candidates.
- **ALT-002**: Combine every change into one refactor commit; rejected because migration, domain-state, and navigation failures require independent review and rollback points.
- **ALT-003**: Edit the current validator migration; rejected because applied migrations are immutable.
- **ALT-004**: Split each chart into a separate shallow module; rejected because it moves markup without concentrating complexity.
- **ALT-005**: Change Bills & Groceries data loading or caching; rejected because no new performance evidence justifies a data-architecture change.

## 4. Dependencies

- **DEP-001**: Current `feature/merchant-automation-rules` checkout and its existing tests.
- **DEP-002**: Bun, Supabase CLI, disposable local database verification, and authenticated browser access.
- **DEP-003**: Explicit `joint-dev` mutation approval and exclusive-writer confirmation before TASK-022.
- **DEP-004**: Execute phases in order and commit each verified phase without switching or pushing the branch.

## 5. Files

- **FILE-001**: `src/lib/automation-conditions.ts` becomes the deep automation-condition module; its Server Action, editor, migration, and tests become consumers/adapters.
- **FILE-002**: `src/lib/transaction-draft.ts` owns transaction state transitions consumed by `TransactionSheet`.
- **FILE-003**: `src/lib/bills-groceries-navigation.ts` owns dashboard URL and navigation policy consumed by the existing dashboard.
- **FILE-004**: A new forward Supabase migration and `supabase/tests/shared_balance.sql` align database enforcement with Note-regex behavior.
- **FILE-005**: `docs/plans/current-branch-review-remediation.md` records this plan; existing design documentation remains unchanged unless implementation would alter its contract.

## 6. Testing

- **TEST-001**: Note regex persists through the database and produces the same preview/manual/import matching behavior as Merchant regex.
- **TEST-002**: Pointer and keyboard reorder preserve connector slots across first, middle, and last-row moves and removals.
- **TEST-003**: Transaction-kind changes permanently clear direct categories, subcategories, and Bills periods without restoring stale state.
- **TEST-004**: Transaction draft initialization and projection preserve manual/import edit behavior, payer values, posting date, Bills ranges, and automation-compatible uncategorized submission.
- **TEST-005**: Presentation URL changes use native history and react to back/forward; period/month changes use Next navigation and reload server data.
- **TEST-006**: Desktop/mobile browser comparison shows no unapproved visual, responsive, focus, keyboard, or accessibility change.
- **TEST-007**: Full local and approved hosted checks pass with generated types matching the applied schema.

## 7. Risks & Assumptions

- **RISK-001**: Broad changes can conceal regressions; phase ordering, focused commits, and independent verification isolate failures.
- **RISK-002**: TypeScript and Postgres validators can drift again; parity cases must exist in both Vitest and pgTAP.
- **RISK-003**: Native History behavior cannot be proven through source tests alone; browser back/forward proof is mandatory.
- **RISK-004**: Draft-state refactoring can alter controlled-field initialization; preserve existing edit/import fixtures and exact form payloads.
- **ASSUMPTION-001**: The persisted `automation_rules.conditions` JSON shape and left-to-right evaluation remain unchanged.
- **ASSUMPTION-002**: No new dependency, route, chart, financial calculation, or production mutation is required.
- **ASSUMPTION-003**: Current approved UI is a hard keep-list; architecture changes are behavior-preserving.

## 8. Related Specifications / Further Reading

- [Merchant automation plan](merchant-automation-rules.md)
- [Joint design system](../design.md)
- [Financial model](../architecture/financial-model.md)
- [Bills & Groceries remediation](bills-groceries-review-remediation.md)
- [Repository contribution rules](../../AGENTS.md)
