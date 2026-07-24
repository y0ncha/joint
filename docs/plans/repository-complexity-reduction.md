---
goal: Reduce repository complexity without changing Joint's financial, access, or UI contracts
version: 1.1
date_created: 2026-07-24
last_updated: 2026-07-24
owner: Joint
status: In progress
tags: [chore, refactor, deletion, tests, documentation, observability]
---

# Introduction

![Status: On Hold](https://img.shields.io/badge/status-On%20Hold-orange)

This plan converts the 2026-07-24 Ponytail whole-repository audit into an approval-gated deletion and simplification change set. It consolidates five fragmented feature briefs into one ordered roadmap before deleting their source directory, and it removes superseded documentation, source-coupled tests, one obsolete redirect route, duplicated validation and type code, and optional Sentry features while preserving core exception reporting, the current product contract, authenticated behavior, Supabase authorization, database history, and owned UI choices.

## 1. Requirements & Constraints

- **REQ-001**: The implementation diff, excluding this plan file and lockfile-only formatting, MUST remove at least 500 net tracked lines and MUST add no runtime or development dependency.
- **REQ-002**: Create `docs/roadmap.md` from all five briefs under `docs/architecture/features/` before deleting that directory; include each feature name and a concise product description, recommend the implementation order Budgets, Recurring Expenses, Bills and Analysis, then Automatic Labelling, and list Transaction CSV Digest as superseded by `docs/plans/transactions-statement-import.md` with no pending implementation order.
- **REQ-003**: Delete the five completed historical specifications under `docs/superpowers/specs/` after verifying their implemented contracts remain represented by `docs/design.md`, `docs/architecture/`, or the applicable source plan.
- **REQ-004**: Remove tests that inspect source files, exact Tailwind class strings, component implementation names, or absence of obsolete implementation identifiers; retain tests that prove rendered user behavior, accessibility semantics, domain calculations, authenticated mutations, parser boundaries, and RLS behavior.
- **REQ-005**: Delete the `/transactions/import` redirect route and its dedicated test; `/transactions?import=1` MUST remain the only import-sheet URL and the visible Transactions-page import action MUST continue to open the sheet.
- **REQ-006**: Replace the duplicated income and expense Zod object definitions with one transaction object using `kind: z.enum(["income", "expense"])` without changing accepted fields, validation messages, or manual/imported category rules.
- **REQ-007**: Replace the one-element `Promise.all` in `SettingsPage` with one direct awaited `household_allowed_members` query without changing owner/member behavior or error text.
- **REQ-008**: Delete the exact `RequiredHousehold = MemberHouseholdContext` alias and use `MemberHouseholdContext` as the return type of `requireCurrentHousehold`.
- **REQ-009**: Keep Sentry exception reporting through `@sentry/nextjs`, `global-error.tsx`, `onRequestError`, client router-transition capture, source-map upload, and the `/monitoring` tunnel.
- **REQ-010**: Remove Sentry Replay, trace sampling, log collection, empty `dataCollection` objects, automatic Vercel Cron monitoring, and generated setup comments; do not add replacement observability code or dependencies.
- **RDM-001**: Roadmap order 1 is **Budgets** — shared monthly household and expense-category spending targets compared with actual ledger spending.
- **RDM-002**: Roadmap order 2 is **Recurring Expenses** — reusable expense schedules whose occurrences require member review before creating ledger transactions.
- **RDM-003**: Roadmap order 3 is **Bills and Analysis** — manually maintained obligations, upcoming and overdue states, and explainable expected-versus-recorded analysis built after recurring-expense scheduling.
- **RDM-004**: Roadmap order 4 is **Automatic Labelling** — optional consent-gated category suggestions from transaction text with no model-authorized financial mutation.
- **RDM-005**: **Transaction CSV Digest** has no implementation order — its template-based read-only digest direction is superseded by the approved persistent workflow in `docs/plans/transactions-statement-import.md`.
- **SEC-001**: Do not change `household_members`, `household_allowed_members`, OAuth routes, Supabase clients, RLS policies, migrations, generated database types, trusted identifier derivation, or Server Action authorization.
- **SEC-002**: Do not weaken file-upload validation, statement parsing limits, sanitized errors, transaction validation, financial invariants, or destructive-action confirmation.
- **CON-001**: Do not start implementation until `docs/plans/transactions-statement-import.md` is `Completed` and its required focused tests, `bun run lint`, `bun run test`, and `bun run build` pass on the user-selected branch.
- **CON-002**: The user creates, names, switches, and organizes branches; plan approval does not authorize branch changes, implementation, merge, push, deployment, or hosted mutation.
- **CON-003**: Preserve the custom owned Calendar, `react-color` picker, InputOTP control, shadcn primitives, and their dependencies because `docs/design.md` explicitly requires those UI choices.
- **CON-004**: Preserve immutable Supabase migration history and generated `src/lib/database.types.ts`; historical schema complexity is not cleanup scope.
- **CON-005**: Preserve `exceljs`, statement-import parsing, member-card mapping, import idempotency, and all tests that protect financial or authorization boundaries.
- **CON-006**: Update existing source plans only to remove broken links or append a concise supersession note; do not rewrite completed task history.
- **CON-007**: `docs/roadmap.md` is directional only; its order and descriptions do not approve implementation, change the current MVP contract, or replace a purpose-specific implementation plan.
- **GUD-001**: Prefer deletion and direct language over replacement abstractions, shared test harnesses, factories, helper layers, or new configuration.
- **PAT-001**: For each retained test file, assert public output or callable behavior rather than reading implementation source with `node:fs`.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Establish a safe baseline and remove speculative or superseded documentation without leaving broken references.

| Task | Description | Status | Date |
|------|-------------|--------|------|
| TASK-001 | Verify `docs/plans/transactions-statement-import.md` is `Completed`, run its required focused tests plus `bun run lint`, `bun run test`, and `bun run build`, and set this plan to `On Hold` if any prerequisite is not satisfied. | Complete | 2026-07-24 |
| TASK-002 | Create `docs/roadmap.md` with an implementation-disclaimer introduction and an `Order`, `Feature`, `Description`, `Depends on`, and `Status` table implementing RDM-001 through RDM-005 exactly. | Complete | 2026-07-24 |
| TASK-003 | Delete all Markdown files under `docs/superpowers/specs/` after mapping each implemented requirement to `docs/design.md`, `docs/architecture/`, or its source plan, and require `rg -n "docs/superpowers/specs|superpowers/specs" AGENTS.md README.md docs --glob "!docs/plans/repository-complexity-reduction.md"` to return no stale reference. | Complete | 2026-07-24 |
| TASK-004 | After TASK-002 and TASK-003 complete, delete `docs/architecture/features/`, update `AGENTS.md` and `docs/architecture.md` to index `docs/roadmap.md`, remove stale feature-brief links from `docs/plans/transactions-statement-import.md`, and require no Markdown link outside this plan to target `docs/architecture/features/` or `docs/plans/features/`. | Complete | 2026-07-24 |

### Implementation Phase 2

- **GOAL-002**: Reduce test coupling while preserving checks for behavior, accessibility, finance, authentication, and database authorization.

| Task | Description | Status | Date |
|------|-------------|--------|------|
| TASK-005 | Delete `src/components/ui-alignment.test.ts`, `src/components/ui/card.test.ts`, `src/components/ui/sheet.test.tsx`, and `src/app/globals.test.ts` after preserving any user-visible or semantic-token contract in `docs/design.md`, and require the remaining suite to pass without replacement source scans. | Complete | 2026-07-24 |
| TASK-006 | Remove every `readFileSync`-based assertion from component and page tests under `src/`, retaining rendered labels, roles, names, values, live regions, keyboard semantics, and action results, and require `rg -n "readFileSync" src --glob "**/*.test.*"` to return zero matches. | Complete | 2026-07-24 |
| TASK-007 | Remove assertions against exact Tailwind utility strings, internal component identifiers, and obsolete negative identifiers from remaining render tests, retaining only assertions whose failure represents a visible behavior or accessibility regression. | Complete | 2026-07-24 |
| TASK-008 | After TASK-005 through TASK-007 complete, run the focused tests for every modified test file and require each file to pass before Phase 3 starts. | Complete | 2026-07-24 |

### Implementation Phase 3

- **GOAL-003**: Delete obsolete application routing and shrink duplicated production code without changing supported behavior.

| Task | Description | Status | Date |
|------|-------------|--------|------|
| TASK-009 | Delete `src/app/(app)/transactions/import/page.tsx` and `page.test.tsx`, remove `/transactions/import` revalidation from `src/app/actions/member-card.ts` and its tests, and verify all internal import links use `/transactions?import=1`. | Complete | 2026-07-24 |
| TASK-010 | Replace `incomeSchema`, `expenseSchema`, and their discriminated union in `src/lib/validation.ts` with one exported `transactionSchema` object using `kind: z.enum(["income", "expense"])`, and require existing validation and transaction-action tests to pass unchanged in behavior. | Complete | 2026-07-24 |
| TASK-011 | Replace the one-query `Promise.all` in `src/app/(app)/settings/page.tsx` with a direct awaited authorization query, and require owner-empty, owner-pending, owner-joined, and member Settings tests to pass. | Complete | 2026-07-24 |
| TASK-012 | Delete `RequiredHousehold` from `src/lib/household.ts`, return `Promise<MemberHouseholdContext>` from `requireCurrentHousehold`, and require household and authenticated-action TypeScript tests to pass. | Complete | 2026-07-24 |

### Implementation Phase 4

- **GOAL-004**: Retain core Sentry error reporting while deleting optional collection and generated configuration boilerplate.

| Task | Description | Status | Date |
|------|-------------|--------|------|
| TASK-013 | Remove `replayIntegration`, `tracesSampleRate`, `enableLogs`, replay sample rates, `dataCollection`, and generated comments from `src/instrumentation-client.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`, retaining only required initialization and exported Next.js hooks. | Planned |  |
| TASK-014 | Remove `automaticVercelMonitors` and generated comments from `next.config.ts` while retaining `withSentryConfig`, organization, project, CI silence, widened source-map upload, `/monitoring`, and debug-log tree shaking. | Planned |  |
| TASK-015 | After TASK-013 and TASK-014 complete, run `bun run build` and require successful Sentry configuration loading and source-map instrumentation without Replay, trace, log, or Cron Monitor configuration. | Planned |  |

### Implementation Phase 5

- **GOAL-005**: Verify the complete reduction, document evidence, and stop for implementation approval.

| Task | Description | Status | Date |
|------|-------------|--------|------|
| TASK-016 | Run focused tests for validation, household context, Settings, member-card actions, Transactions import-sheet behavior, and every modified render-test file, requiring exit code 0. | Planned |  |
| TASK-017 | Run `bun run lint`, `bun run test`, `bun run build`, and `git diff --check`, requiring exit code 0 for every command. | Planned |  |
| TASK-018 | Measure `git diff --numstat` excluding `docs/plans/repository-complexity-reduction.md`, require at least 500 net deleted tracked lines and zero added dependency entries, and remove additional source-coupled assertions rather than production safeguards if the target is not met. | Planned |  |
| TASK-019 | Review the final diff against REQ-001 through REQ-010, RDM-001 through RDM-005, SEC-001 through SEC-002, and CON-001 through CON-007, report retained behavior and removed complexity, and wait for explicit implementation approval without merging, pushing, deploying, or mutating hosted state. | Planned |  |

## 3. Alternatives

- **ALT-001**: Replace source-reading tests with a generic filesystem scanner or snapshot framework. Rejected because it recreates the same implementation coupling behind a new abstraction.
- **ALT-002**: Retain the five separate feature briefs. Rejected because the user explicitly requested one concise ordered roadmap and deletion of the fragmented source directory after consolidation.
- **ALT-003**: Delete all Sentry integration. Rejected because core exception reporting, source maps, and the existing production monitoring boundary remain useful and already implemented.
- **ALT-004**: Replace Calendar, `react-color`, or InputOTP with native inputs. Rejected because the current approved design explicitly requires the owned controls.
- **ALT-005**: Squash, rewrite, or delete historical Supabase migrations. Rejected because applied migrations are immutable operational history.
- **ALT-006**: Add shared action, revalidation, query, or test-builder abstractions while touching duplicated code. Rejected because the audit found no repeated complexity large enough to justify new indirection.

## 4. Dependencies

- **DEP-001**: Explicit user approval of this plan before implementation.
- **DEP-002**: Completion and successful verification of `docs/plans/transactions-statement-import.md`.
- **DEP-003**: The user-selected branch and a working tree safe for the approved deletion scope.
- **DEP-004**: Existing Bun, Vitest, Next.js, Sentry, Supabase, Zod, and TypeScript dependencies; no new package is permitted.
- **DEP-005**: Existing `docs/design.md`, `docs/architecture.md`, completed source plans, and the new directional `docs/roadmap.md` as the retained documentation after historical/speculative document deletion.
- **DEP-006**: Execute phases in numeric order; within Phase 1 TASK-004 depends on TASK-002 and TASK-003, within Phase 2 TASK-008 depends on TASK-005 through TASK-007, and within Phase 4 TASK-015 depends on TASK-013 and TASK-014.

## 5. Files

- **FILE-001**: `docs/architecture/features/*.md` — source five feature names and descriptions for `docs/roadmap.md`, then delete the directory.
- **FILE-002**: `docs/roadmap.md` — retain the ordered post-MVP feature summary and statement-import supersession status.
- **FILE-003**: `docs/superpowers/specs/*.md` — delete five completed historical specifications.
- **FILE-004**: `AGENTS.md`, `docs/architecture.md`, and `docs/plans/transactions-statement-import.md` — index the roadmap and remove stale feature-directory links without rewriting completed task history.
- **FILE-005**: `src/**/*.test.ts` and `src/**/*.test.tsx` files containing `readFileSync`, exact utility-class assertions, or obsolete identifier absence scans — delete or reduce implementation-coupled checks.
- **FILE-006**: `src/app/(app)/transactions/import/page.tsx`, its test, `src/app/actions/member-card.ts`, and its test — remove the redirect alias and obsolete revalidation.
- **FILE-007**: `src/lib/validation.ts` — use one transaction schema with an enum kind.
- **FILE-008**: `src/app/(app)/settings/page.tsx` — await the owner authorization query directly.
- **FILE-009**: `src/lib/household.ts` — remove the exact type alias.
- **FILE-010**: `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `next.config.ts` — retain core Sentry errors and source maps while removing optional features and generated comments.
- **FILE-011**: `docs/plans/repository-complexity-reduction.md` — record task status and verification evidence during execution.

## 6. Testing

- **TEST-001**: Existing financial-report, statement-parser, import-action, transaction-action, household-context, OAuth, and pgTAP tests remain present and behaviorally unchanged.
- **TEST-002**: Remaining component and page tests assert rendered labels, roles, field names, live regions, links, values, and actions without reading source files.
- **TEST-003**: `/transactions?import=1` renders the Transactions page with the import sheet open after the redirect route is deleted.
- **TEST-004**: Transaction schema tests prove both kinds accept the same valid fields and preserve all existing invalid amount, date, category, payer, merchant, and note errors.
- **TEST-005**: Settings tests prove direct authorization loading preserves owner-empty, pending, joined, and member states.
- **TEST-006**: Household and Server Action tests compile and pass after deleting `RequiredHousehold`.
- **TEST-007**: The production build initializes Sentry error hooks and source-map configuration without Replay, trace sampling, log collection, or Cron Monitor configuration.
- **TEST-008**: Full lint, test, build, whitespace, dependency, stale-reference, and net-line-reduction checks pass before implementation approval.
- **TEST-009**: `docs/roadmap.md` contains exactly one entry for each of the five source briefs, uses the approved four-feature implementation order, marks Transaction CSV Digest as superseded, and states that roadmap entries do not authorize implementation.

## 7. Risks & Assumptions

- **RISK-001**: Removing source-coupled tests can accidentally remove a meaningful accessibility or product assertion. Mitigation: preserve each user-visible label, role, field contract, live region, keyboard behavior, action result, financial invariant, and authorization boundary as a rendered or callable behavior check.
- **RISK-002**: Consolidating roadmap briefs can discard useful future-feature context. Mitigation: preserve each feature's name, concise product purpose, implementation dependency, relative order, and supersession status in `docs/roadmap.md` before deleting the source directory.
- **RISK-003**: External bookmarks may still target `/transactions/import`. Mitigation: the application has no internal caller; release notes identify `/transactions?import=1` as the sole supported URL.
- **RISK-004**: Reducing Sentry options lowers replay, trace, and log visibility. Mitigation: preserve exception capture, request-error capture, router-transition capture, source maps, and the tunnel; restore optional telemetry only through a separately justified observability change.
- **RISK-005**: The active statement-import work can overlap tests and route files in this plan. Mitigation: CON-001 blocks implementation until that plan is complete and verified.
- **ASSUMPTION-001**: The 2026-07-24 audit's estimated 647-line reduction remains achievable after the active statement-import plan completes.
- **ASSUMPTION-002**: No supported external integration depends on `/transactions/import`; repository search currently finds only the redirect, its test, action revalidation, and source-plan references.
- **ASSUMPTION-003**: Sentry Replay, tracing, logs, and automatic Cron Monitors have no approved product or operational acceptance requirement.
- **ASSUMPTION-004**: Budgets should precede Recurring Expenses, Recurring Expenses should precede Bills and Analysis to avoid overlapping schedule models, and Automatic Labelling should remain last because it adds an external AI-provider and consent boundary.

## 8. Related Specifications / Further Reading

- [Joint agent guide](../../AGENTS.md)
- [Joint design system](../design.md)
- [Joint architecture overview](../architecture.md)
- [Joint roadmap](../roadmap.md)
- [Application runtime](../architecture/application-runtime.md)
- [CI/CD architecture](../architecture/ci-cd.md)
- [Statement import implementation plan](transactions-statement-import.md)
- [Request-context and notification cleanup plan](request-context-notification-cleanup.md)
