---
goal: Remove verified dead and redundant UI code without changing Joint's rendered design or behavior
version: 1.0
date_created: 2026-07-30
last_updated: 2026-07-30
owner: Joint maintainers
status: "Completed"
tags: [chore, refactor, deletion, ui]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan removes verified dead owned UI code and consolidates two identical Settings text controls while preserving every currently rendered class, interaction, accessibility contract, and responsive layout.

Completion evidence: focused tests passed 14/14, the full suite passed 220/220, lint and `git diff --check` passed, deleted-symbol scans found no source references, package files were unchanged, and the source diff removed 302 net lines. Authenticated desktop/mobile Settings and Categories captures remained visually equivalent; the mobile transaction-create capture was byte-identical and its desktop/mobile dialog accessibility tree was unchanged. The empty July ledger provided no transaction-edit state to verify.

## 1. Requirements & Constraints

- **REQ-001**: Preserve current DOM structure, classes, accessibility semantics, interactions, and responsive behavior for every rendered component.
- **REQ-002**: Remove at least 250 net tracked lines, excluding this plan, without adding dependencies.
- **REQ-003**: Delete only code with no current production caller and keep internally required primitive helpers private.
- **CON-001**: Preserve unrelated Essentials work and patch overlapping tests narrowly.
- **CON-002**: Do not alter routes, Server Actions, financial logic, Supabase schema, migrations, generated types, or design documentation.
- **CON-003**: Do not run `bun run build`, create or switch branches, commit, push, deploy, or mutate hosted state.
- **CON-004**: Keep `shadcn`, Radix, Recharts, Calendar, InputOTP, and every currently required dependency.
- **CON-005**: Leave the existing Essentials `stackedBarRadius` TypeScript errors to the active Essentials plan.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Establish clean behavioral and visual baselines before editing UI source.

| Task     | Description                                                                                                                           | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-001 | Record the selected branch and worktree status, run `bun run lint` and `bun run test`, and require clean lint plus 220 passing tests. | Complete | 2026-07-30 |
| TASK-002 | Capture authenticated desktop and mobile Settings, Categories, and transaction-create visuals and record any unavailable edit state.  | Complete | 2026-07-30 |

### Implementation Phase 2

- **GOAL-002**: Delete verified dead primitive code without changing any rendered consumer.

| Task     | Description                                                                                                                   | Status      | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| TASK-003 | Delete the unused Toggle and ToggleGroup primitives, remove the stale transaction test mock, and verify no reference remains. | Complete | 2026-07-30 |
| TASK-004 | Remove the fixed list of unused optional owned-primitive components and their unreachable imports and selector fragments.     | Complete | 2026-07-30 |
| TASK-005 | Stop exporting internally used-only chart, calendar, dialog, and select helpers while retaining their implementations.        | Complete | 2026-07-30 |
| TASK-006 | Delete `isSubcategoryPastelColor()` and its dedicated test assertions while retaining every production-used color helper.     | Complete | 2026-07-30 |

### Implementation Phase 3

- **GOAL-003**: Consolidate duplicate Settings text controls without changing their markup or form contract.

| Task     | Description                                                                                                                                   | Status      | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| TASK-007 | Add one file-local `SettingsTextControl` to the Settings page with the exact existing wrapper, hidden initial value, label, and input markup. | Complete | 2026-07-30 |
| TASK-008 | Replace both one-use Settings text components with the local component and delete their source files.                                         | Complete | 2026-07-30 |

### Implementation Phase 4

- **GOAL-004**: Verify behavior, visual equivalence, reference cleanup, and net reduction.

| Task     | Description                                                                                                                           | Status  | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---- |
| TASK-009 | Run focused tests, `bun run lint`, `bun run test`, and `git diff --check`, requiring exit code 0.                                     | Complete | 2026-07-30 |
| TASK-010 | Repeat desktop and mobile captures and require no visible change in the verified Settings, Categories, and transaction-create states. | Complete | 2026-07-30 |
| TASK-011 | Require no deleted-symbol references, no dependency changes, and at least 250 net deleted lines excluding this plan.                  | Complete | 2026-07-30 |

## 3. Alternatives

- **ALT-001**: Keep dormant shadcn exports for possible future use; rejected because the CLI can restore them when a real caller exists.
- **ALT-002**: Remove `shadcn`; rejected because global CSS and owned-component tooling still require it.
- **ALT-003**: Consolidate category option mapping; rejected because its editor shapes differ and a shared layer would not materially reduce code.
- **ALT-004**: Abstract the Essentials dashboard; rejected because its chart-specific markup preserves distinct visual and accessibility behavior.
- **ALT-005**: Include the current Essentials tuple-type fix; rejected as separate active feature work.

## 4. Dependencies

- **DEP-001**: The existing user-selected branch and working tree.
- **DEP-002**: Existing Bun, Vitest, ESLint, authenticated local session, and browser verification environment.
- **DEP-003**: Execute phases in order and complete all verification before marking the plan complete.

## 5. Files

- **FILE-001**: `docs/plans/current-state-code-cleanup.md` records scope, task status, and evidence.
- **FILE-002**: `src/components/ui/` loses dead Toggle files and unused optional primitive components.
- **FILE-003**: `src/app/(app)/settings/page.tsx` owns the consolidated local text control; the two one-use component files are deleted.
- **FILE-004**: `src/lib/shared-colors.ts`, its test, and `src/components/transaction-sheet.test.tsx` lose test-only code.

## 6. Testing

- **TEST-001**: Run focused transaction-sheet, Settings-page, and shared-color tests.
- **TEST-002**: Run `bun run lint`, `bun run test`, and `git diff --check`.
- **TEST-003**: Search the repository for every deleted symbol, file import, and stale mock.
- **TEST-004**: Compare before and after desktop/mobile visuals for Settings, Categories, and transaction create.
- **TEST-005**: Measure the source diff excluding this plan and require at least 250 net deleted lines with no dependency changes.

## 7. Risks & Assumptions

- **RISK-001**: A dormant primitive may be referenced non-statically; mitigate with source, test, CSS, config, and dynamic-import searches.
- **RISK-002**: Settings consolidation may alter form submission; preserve exact field identifiers, names, initial values, autocomplete values, association, and markup.
- **RISK-003**: The current ledger contains no transaction to open for edit; report that browser gap without creating financial data.
- **ASSUMPTION-001**: Cleanup-only scope excludes existing Essentials type errors.
- **ASSUMPTION-002**: No future reservation justifies retaining currently unused owned primitives.

## 8. Related Specifications / Further Reading

- [Joint agent guide](../../AGENTS.md)
- [Joint design system](../design.md)
- [Completed repository complexity reduction](repository-complexity-reduction.md)
- [Essentials implementation plan](essentials-dashboard.md)
