---
goal: Add ordered merchant automation rules for normalization and category assignment
version: 1.1
date_created: 2026-08-07
last_updated: 2026-08-08
owner: Joint
status: "In Progress"
tags: [feature, automation, transactions, imports, supabase]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In_Progress-yellow)

Implement household-owned, ordered merchant rules. Each atomic rule either normalizes a merchant or assigns a transaction destination. Rules affect new manual and statement-import transactions; existing transactions require preview and explicit confirmation. Replace the raw regular-expression field with a literal match builder while retaining the existing persisted pattern contract. The follow-up condition-builder phase adds a persisted AND/OR group across merchant, note, and amount fields.

## 1. Requirements & Constraints

- **REQ-001**: Add `/automations`, linked from Settings, with accessible list, create, edit, enable, delete, and drag/keyboard reorder behavior.
- **REQ-002**: Support only `normalize_merchant`, `assign_category`, and preview-confirmed `delete_transaction`; future actions require a separate approved migration and plan.
- **REQ-003**: Evaluate RE2-compatible patterns case-insensitively against the original trimmed merchant; first enabled match per action wins by persisted order.
- **REQ-004**: Preserve an explicit manual destination; a blank manual destination resolves through the category rule or retains the current validation error.
- **REQ-005**: Apply rules while creating manual and statement-import transactions, never implicitly on edit, and bulk-apply existing rows only after preview and confirmation.
- **REQ-006**: Replace the raw merchant-pattern input with an owned `Select` matching the current Action dropdown style and containing exactly `Contains`, `Is exactly`, `Starts with`, and `Ends with` for new rules.
- **REQ-007**: Convert trimmed literal merchant text with `RE2JS.quote` on the server to `quoted`, `^quoted$`, `^quoted`, or `quoted$` for `contains`, `equals`, `starts_with`, or `ends_with`, respectively.
- **REQ-008**: Decode existing patterns that are losslessly equivalent to the four builder modes and expose `Matches regex` for Merchant and Note conditions; existing undecodable merchant patterns retain their raw regex value without changing behavior.
- **REQ-009**: Render builder rules as a localized operator label plus literal or regex value in the ordered list and conflict guidance.
- **REQ-010**: Keep `automation_rules.pattern`, rule evaluation, preview fingerprints, bulk application, RLS, and generated database types unchanged; this phase must create no migration and run no linked Supabase write.
- **REQ-011**: Phase 9 supersedes REQ-010 only for the expanded condition builder: add optional validated `automation_rules.conditions` JSONB, preserve null-condition legacy rules, include conditions in stale-preview snapshots, and do not apply the new migration to hosted `joint-dev` without explicit approval and the required preflight.
- **REQ-012**: A condition group has one to eight conditions. Legacy groups may use one `and` or `or` logic value; new groups persist an AND/OR connector on every condition after the first and evaluate left to right. Fields are `merchant`, `note`, or `amount`; Merchant and Note operators are literal contains/equal/starts-with/ends-with plus RE2 `Matches regex`, and Amount operators are equals, not-equals, greater-than, greater-than-or-equal, less-than, and less-than-or-equal.
- **SEC-001**: Derive household identity server-side, use household RLS, use linear-time RE2 matching, and make confirmed bulk changes atomic.
- **SEC-002**: Treat `matchMode` and `matchValue` as untrusted Server Action input, allow only the declared modes, validate the compiled pattern length against the existing 200-character database constraint, and compile it with RE2 before persistence.
- **CON-001**: Use a generated forward migration, verified `joint-dev`, generated database types, focused/full tests, lint, formatting, and browser proof; do not run `bun run build` unless requested.
- **CON-002**: Obtain visual confirmation of the match builder in the existing right-side Sheet before connecting its submitted values to persistence.
- **CON-003**: Preserve the user-selected branch and unrelated working-tree changes, and commit only after each completed implementation phase as required by `AGENTS.md`.

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
| TASK-008 | Run focused/full tests, lint, format check, pgTAP, browser workflows, update architecture documentation, and commit intended files.  | Complete | 2026-08-07 |

### Implementation Phase 5

- **GOAL-005**: Close the final-review concurrency and historical-data gaps without changing the approved product surface.

| Task     | Description                                                                                                                                                            | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-009 | Add focused regressions and a generated forward migration for locked rule-set validation, orphaned-manual normalization, and enabled-only toggles.                     | Complete | 2026-08-07 |
| TASK-010 | Apply and verify the forward migration on `joint-dev`, regenerate hosted database types, run advisors, and repeat the affected browser workflows after local delivery. | Complete | 2026-08-07 |

### Implementation Phase 6

- **GOAL-006**: Approve the literal match-builder contract and its visual arrangement before changing form submission behavior.

| Task     | Description                                                                                                                                                                                                                                                                                                     | Status   | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-011 | Update `docs/design.md`, temporarily render the four-mode Select match builder in `AutomationRuleForm` within `src/components/automation-rules-workspace.tsx`, obtain browser confirmation of the add and edit Sheets at mobile and desktop widths, and restore the temporary component edit before continuing. | Complete | 2026-08-08 |

### Implementation Phase 7

- **GOAL-007**: Implement and connect the approved match builder without changing the database schema or evaluation semantics; TASK-012 must complete before TASK-013 and TASK-014 begin.

| Task     | Description                                                                                                                                                                                                                                                                                                                          | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| TASK-012 | Add `MerchantMatchMode`, literal pattern encoding, lossless existing-pattern decoding, and friendly descriptions in `src/lib/merchant-pattern.ts`, and prove all modes, RE2 metacharacters, Hebrew text, anchors, and advanced fallback in `src/lib/merchant-pattern.test.ts`.                                                       | Complete | 2026-08-08 |
| TASK-013 | Replace the raw pattern field and raw rule labels in `src/components/automation-rules-workspace.tsx` with the approved operator/value controls and friendly descriptions, and verify create, edit, legacy-advanced, keyboard, focus, and 44px-target behavior in `src/components/automation-rules-workspace.test.tsx`.               | Complete | 2026-08-08 |
| TASK-014 | Replace raw `pattern` parsing in `src/app/actions/merchant-automations.ts` with server-side `matchMode` and `matchValue` validation through `src/lib/merchant-pattern.ts`, and verify canonical persistence, compiled-length rejection, invalid modes, and advanced compatibility in `src/app/actions/merchant-automations.test.ts`. | Complete | 2026-08-08 |

### Implementation Phase 8

- **GOAL-008**: Verify the complete builder flow and record only proven behavior; TASK-015 must complete before TASK-016 begins.

| Task     | Description                                                                                                                                                                                                                                                                                   | Status   | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-015 | Run the focused Vitest files, full `bun run test`, `bun run lint`, `bun run format:check`, and browser create/edit workflows for all four literal modes plus one existing advanced pattern, and confirm previews and newly created manual/imported transactions retain their prior semantics. | Complete | 2026-08-08 |
| TASK-016 | Update `docs/architecture/financial-model.md` and this plan only with TASK-015 evidence, mark TASK-011 through TASK-016 accurately, and verify `git diff --check` reports no whitespace errors.                                                                                               | Complete | 2026-08-08 |

TASK-015's originally unrecorded completion is supported by the later, broader Phase 9–12 focused/full checks and browser workflows for text/regex create and edit, previews, manual creation, statement imports, keyboard reorder, and destructive-rule behavior. TASK-016 was reconciled after the durable architecture record was updated with the final condition-module and validator behavior.

### Implementation Phase 9

- **GOAL-009**: Expand rules from merchant-only matching to a validated condition group while preserving legacy rules, atomic actions, ordering, previews, and the main-page enable control.

| Task     | Description                                                                                                                                                                                                                          | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| TASK-017 | Add the forward `automation_rules.conditions` migration and connector-validator migration, stale-preview snapshot support, generated database types, and focused database/action regressions.                                        | Complete | 2026-08-08 |
| TASK-018 | Extend the server evaluator and manual/import intake with Merchant, Note, and numeric Amount conditions, preserving legacy group logic and adding left-to-right per-row connectors.                                                  | Complete | 2026-08-08 |
| TASK-019 | Update the Add/Edit Sheet with compact repeatable rows, per-row AND/OR connectors, field-specific operators and numeric inputs; keep Enabled on the ordered list and align Add rule actions.                                         | Complete | 2026-08-08 |
| TASK-020 | Run focused/full tests, lint, formatting, and browser proof for text, numeric, AND/OR, enable, create, edit, preview, manual-create, and statement-import flows; update architecture/design evidence and mark this phase accurately. | Complete | 2026-08-08 |

### Implementation Phase 10

- **GOAL-010**: Make flat condition ordering directly manipulable without changing its persisted, left-to-right condition model.

| Task     | Description                                                                                                                             | Status   | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-021 | Add pointer and keyboard drag handles to condition rows; preserve connector positions between rows and keep nested groups out of scope. | Complete | 2026-08-08 |
| TASK-022 | Verify focused component behavior, lint, whitespace, and an unsaved browser keyboard reorder workflow.                                  | Complete | 2026-08-08 |

### Implementation Phase 11

- **GOAL-011**: Allow an ordered rule to permanently delete matching existing transactions only after the server-derived preview and explicit confirmation.

| Task     | Description                                                                                                                                                            | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-023 | Add the `delete_transaction` action, guarded database validation and atomic delete-or-update RPC behavior, preview fingerprint coverage, and focused regressions.      | Complete | 2026-08-08 |
| TASK-024 | Add destructive editor/preview copy, verify the unsaved local browser flow, and confirm manual creation and statement imports continue to ignore delete-rule outcomes. | Complete | 2026-08-08 |

### Implementation Phase 12

- **GOAL-012**: Permit RE2 conditions for either supported text field without changing rule storage or amount matching.

| Task     | Description                                                                                                                                          | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-025 | Add the `Matches regex` operator to Merchant and Note rows, validate both fields with RE2, and verify unit, action, component, and browser behavior. | Complete | 2026-08-08 |

## 3. Alternatives

- **ALT-001**: A sequential pipeline was rejected because normalization would silently change later rule matches.
- **ALT-002**: Database-trigger matching was rejected because it would diverge from UI preview semantics.
- **ALT-003**: Generic JSON automations were rejected because only two concrete actions are approved.
- **ALT-004**: Persisting separate match-mode and match-value columns was rejected because the existing RE2 pattern stores all four semantics and a migration would add no execution capability.
- **ALT-005**: Converting literal input to a pattern only in the client was rejected because Server Actions must validate and canonicalize untrusted form input.
- **ALT-006**: Removing support for existing arbitrary RE2 patterns was rejected because editing a stored rule must not silently change its matching behavior.

## 4. Dependencies

- **DEP-001**: `re2js@2.8.5` for safe user-authored matching.
- **DEP-002**: `@dnd-kit/react@0.5.0` and `@dnd-kit/helpers@0.5.0` for accessible sorting.
- **DEP-003**: Explicit authorization and exclusive writer access for hosted `joint-dev` migration work.
- **DEP-004**: Existing pinned `re2js@2.8.5`, specifically `RE2JS.quote`, for literal pattern encoding without a new dependency.
- **DEP-005**: TASK-011 visual approval before implementation and TASK-012 shared helpers before UI or Server Action integration.

## 5. Files

- **FILE-001**: `supabase/migrations/<generated>_add_merchant_automation_rules.sql` and `supabase/tests/shared_balance.sql`.
- **FILE-002**: `src/lib/merchant-automations.ts`, `src/app/actions/merchant-automations.ts`, and focused tests.
- **FILE-003**: `src/app/(app)/automations/page.tsx`, `src/components/automation-rules-workspace.tsx`, and Settings/transaction/import integration.
- **FILE-004**: `docs/design.md` and `docs/architecture/financial-model.md`.
- **FILE-005**: `src/lib/merchant-pattern.ts` and `src/lib/merchant-pattern.test.ts` — match-mode types, encoding, decoding, descriptions, and focused regressions.
- **FILE-006**: `src/components/automation-rules-workspace.tsx` and `src/components/automation-rules-workspace.test.tsx` — match-builder controls and friendly rule summaries.
- **FILE-007**: `src/app/actions/merchant-automations.ts` and `src/app/actions/merchant-automations.test.ts` — server-side builder validation and canonical pattern persistence.
- **FILE-008**: No file under `supabase/migrations/`, `supabase/tests/`, or `src/lib/database.types.ts` may change for the builder phase.

## 6. Testing

- **TEST-001**: Pure engine tests cover Hebrew patterns, ordering, conflicts, disabled rules, literal normalization, and invalid RE2 syntax.
- **TEST-002**: Action and database tests cover RLS, payload/destination validation, reordering, stale preview rejection, and atomic bulk application.
- **TEST-003**: Transaction/import tests cover explicit destination precedence, automatic blank resolution, normalization, and import idempotency.
- **TEST-004**: Browser checks cover rule management, pointer and keyboard sorting, real forms, preview/confirmation, manual entry, and import.
- **TEST-005**: The final-review wave has local evidence from 381 passing Vitest tests, 165 passing pgTAP assertions in a disposable unlinked Postgres instance, clean ESLint, Prettier, TypeScript, and public/private schema lint. Linked history, dry-run, application, type generation, advisors, and hosted browser proof remain blocked because this isolated worktree has no `supabase/.temp/project-ref`; no linked command was run.
- **TEST-006**: Focused helper tests prove exact canonical patterns for all four modes and lossless fallback for every existing pattern that is not a quoted literal with optional builder anchors.
- **TEST-007**: Focused Server Action tests prove submitted raw `pattern` fields are ignored, unsupported modes fail validation, and only server-built RE2 patterns reach insert or update calls.
- **TEST-008**: Component tests prove add and edit Sheets expose the correct operator/value state, including `Matches regex` for Merchant and Note, and friendly summaries replace raw canonical patterns.
- **TEST-009**: Browser proof covers add and edit Sheets at mobile and desktop widths, keyboard-only operation, literal metacharacters, Hebrew text, all four match modes, preview output, and one new manual or imported transaction matched by a saved builder rule.

## 7. Risks & Assumptions

- **RISK-001**: Future regex overlap cannot be proven generally; current-data previews and visible ordered precedence mitigate it.
- **RISK-002**: Rules must never auto-assign Bills because their service periods cannot be inferred.
- **RISK-003**: Confirming a historical preview takes a short table-wide shared lock on automation rules. This is appropriate for rare applies, but a per-household version row is the next step if cross-household rule-write contention appears.
- **RISK-004**: RE2 quoting can expand a literal beyond the database's 200-character pattern limit; reject the compiled value with a field error before persistence rather than truncating it.
- **RISK-005**: Existing arbitrary patterns may resemble builder output; decode a pattern only when removing optional builder anchors and reversing quoting can reproduce the original pattern exactly.
- **ASSUMPTION-001**: Existing category rules affect only uncategorized rows; normalization may affect any matching merchant after confirmation.
- **ASSUMPTION-002**: Both household members manage the shared ordered rule list.
- **ASSUMPTION-003**: Case-insensitive matching against the original trimmed merchant remains unchanged for every builder mode.

## 8. Related Specifications / Further Reading

- [Joint design system](../design.md)
- [Financial model](../architecture/financial-model.md)
- [Statement import plan](transactions-statement-import.md)
- [RE2 syntax](https://github.com/google/re2/wiki/syntax)
- [dnd-kit accessibility](https://docs.dndkit.com/guides/accessibility)
