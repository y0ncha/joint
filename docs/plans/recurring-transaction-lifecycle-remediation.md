---
goal: Make recurring transaction identity, editing, lifecycle, and cron processing atomic and durable
version: 1.0
date_created: 2026-08-16
last_updated: 2026-08-16
owner: Joint maintainers
status: "Complete"
tags: [architecture, migration, recurring-transactions, security, cron]
---

# Introduction

![Status: Complete](https://img.shields.io/badge/status-Complete-brightgreen)

This plan removes the split identity and partial-write paths in recurring transactions without introducing a scheduler service, queue, or generic form framework. PostgreSQL remains the lifecycle authority, Vercel Cron remains a thin authenticated trigger, every occurrence including the anchor row uses one canonical schedule link, and the existing transaction sheet uses one atomic save path for regular-to-recurring conversion and recurring edits.

## 1. Requirements & Constraints

- **REQ-001**: Treat the selected regular manual income or expense as occurrence zero when it is converted, set its `scheduled_for` to its existing `occurred_on`, and calculate `next_occurs_on` from the following cadence occurrence.
- **REQ-002**: Represent every recurring occurrence only through `transactions.recurring_schedule_id` and `transactions.scheduled_for`; remove `recurring_transaction_schedules.first_occurrence_transaction_id` after its data is backfilled and verified.
- **REQ-003**: Persist schedule lifecycle as `active`, `paused`, `stopped`, or `blocked`; make `stopped` terminal, reserve `blocked` for database processing or destination failures, and retain historical schedule and occurrence lineage after stopping.
- **REQ-004**: Persist each lifecycle transition in `recurring_transaction_schedule_events` with schedule, household, previous status, new status, reason, actor when available, and timestamp.
- **REQ-005**: Save a recurring occurrence edit and any cadence/template change in one database transaction with schedule-first lock ordering.
- **REQ-006**: Preserve the existing scope contract: `this` may change the selected row including kind and posting date; `future` updates the template for ungenerated occurrences only; `all` updates the template and linked rows while preserving every existing row's `occurred_on` and `scheduled_for`.
- **REQ-007**: Convert a regular transaction through the same recurring form fields already used to edit a recurring schedule and one `Save changes` submission.
- **REQ-008**: Return exact created and blocked counts from due processing, return HTTP 500 for unexpected database failures, and retain idempotent catch-up behavior for overlapping or duplicate cron invocations.
- **SEC-001**: Derive household and actor identity from the authenticated session; never accept household ownership, creator identity, or lifecycle actor from browser input.
- **SEC-002**: Reject cross-household transaction-to-schedule links with a composite foreign key and reject half-populated recurrence metadata with a database check constraint.
- **SEC-003**: Reject direct `anon` and `authenticated` writes to transaction recurrence metadata while allowing only protected lifecycle functions and the service-role processor to set it.
- **SEC-004**: Keep schedule mutation functions `security definer` only where required, set `search_path = ''`, schema-qualify all objects, perform explicit membership checks, revoke execution from `public` and `anon`, and grant only the minimum roles.
- **SEC-005**: Keep RLS enabled on both recurring tables; household members may select their schedules and lifecycle events but may mutate them only through approved RPCs.
- **DB-001**: Add `public.recurring_schedule_status` with exactly `active`, `paused`, `stopped`, and `blocked`; replace the stored `enabled` column with a generated compatibility column defined as `(status = 'active')` for one application release.
- **DB-002**: Rename `paused_reason` to `status_reason`, replace the due partial index predicate with `status = 'active'`, and add partial indexes for non-null schedule `category_id` and `subcategory_id` foreign keys.
- **DB-003**: Require linked recurring transactions to use `source = 'manual'` and require `recurring_schedule_id` and `scheduled_for` to be both null or both non-null.
- **DB-004**: Retain the existing unique partial index on `(recurring_schedule_id, scheduled_for)` and the 366-occurrence catch-up cap.
- **DB-005**: Record schema changes in one forward repository migration created with `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new deepen_recurring_transaction_lifecycle`; do not edit an applied migration.
- **API-001**: Add `public.convert_transaction_to_recurring_schedule(...) returns uuid`, `public.save_recurring_transaction_occurrence(...) returns void`, and `public.set_recurring_transaction_schedule_status(uuid, public.recurring_schedule_status) returns void` as the only new public mutation entry points.
- **API-002**: Keep `public.set_recurring_transaction_schedule_enabled(uuid, boolean)` and `public.delete_recurring_transaction_schedule(uuid)` as one-release compatibility adapters that delegate to status transitions; the delete adapter must transition to `stopped` and must not delete data.
- **API-003**: Make `public.process_due_recurring_transaction_schedules(date)` return JSONB with integer keys `created_count` and `blocked_count`; known permanent destination failures must transition the schedule to `blocked`, while unexpected failures must abort and surface to the cron route.
- **UI-001**: Keep one transaction sheet, one recurring field template, one primary save button at the bottom, and existing icon-only pause/resume and stop controls beside the cadence selector.
- **UI-002**: When kind or posting date changes on a recurring row, allow only `this`; do not submit cadence changes for `this`, and do not permit kind or posting-date changes for `future` or `all`.
- **A11Y-001**: Preserve keyboard access, visible focus, accessible names, confirmation for stop, and 44px mobile targets for all recurring controls.
- **OPS-001**: Keep the existing daily `0 3 * * *` Vercel schedule and `CRON_SECRET` authorization; do not add Redis, a queue, `pg_cron`, retry infrastructure, or another service client until measurements show the current processor is insufficient.
- **OPS-002**: Before every linked Supabase command, verify `supabase/.temp/project-ref` equals `magcvzqnwrwxkhtsfspg`, run migration history, dry-run, push, and history in that order, and use `joint-dev` only.
- **CON-001**: Do not push, deploy, apply to `joint-prod`, or mutate production data without separate explicit user approval; production migrations run only through `.github/workflows/cd.yml` before the application deploy.
- **CON-002**: Preserve positive ILS amounts, kind-based direction, category/payer/Bills-period validation, immutable cadence anchors, month-end clipping, UTC ISO dates, and one shared household balance.
- **CON-003**: Update architecture and design contracts before runtime code, regenerate `src/lib/database.types.ts` after the migration, and do not add dependencies.
- **CON-004**: Preserve unrelated working-tree changes and do not create, switch, or clean branches or worktrees.
- **PAT-001**: Use database constraints for data shape, protected RPCs for multi-row mutations, existing Server Actions for authenticated application entry points, and the existing cron route as a thin adapter.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Record the approved recurring lifecycle contract before changing schema or runtime behavior.

| Task     | Description                                                                                                                                                                                                                                                                                                             | Status   | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-001 | Update `docs/architecture/recurring-transactions.md` with canonical occurrence identity, atomic mutation boundaries, lifecycle states and events, schedule-first locking, due-processor outcomes, compatibility adapters, and UTC date ownership, then verify every requirement REQ-001 through REQ-008 is represented. | Complete | 2026-08-16 |
| TASK-002 | Update the `recurring_transaction_schedules` and recurring-history language in `docs/architecture/financial-model.md` to state that stopped schedules and linked occurrences remain queryable, then verify it no longer describes deletion as a lifecycle action.                                                       | Complete | 2026-08-16 |
| TASK-003 | Update the transaction-sheet recurring interaction contract in `docs/design.md` to define regular-to-recurring conversion, shared recurrence fields, scope restrictions, one bottom save button, and adjacent accessible lifecycle icons, then verify the contract covers desktop and mobile targets.                   | Complete | 2026-08-16 |
| TASK-004 | Revise `docs/superpowers/specs/2026-08-16-convert-transaction-to-recurring-design.md` to replace its no-migration assumption with the canonical lineage and atomic conversion RPC defined here, then verify the selected row is occurrence zero for both income and expense.                                            | Complete | 2026-08-16 |

### Implementation Phase 2

- GOAL-002: Install one backward-compatible database migration that canonicalizes lineage, persists lifecycle history, and makes mutations atomic.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                            | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-005 | Create the repository migration with `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new deepen_recurring_transaction_lifecycle` and place all Phase 2 SQL only in the generated `supabase/migrations/*_deepen_recurring_transaction_lifecycle.sql`, then verify no applied migration changed.                                                                       | Complete | 2026-08-16 |
| TASK-006 | In the new migration, lock `public.recurring_transaction_schedules` and `public.transactions`, backfill each `first_occurrence_transaction_id` row with its schedule ID and anchor date, abort on mismatches or collisions, drop the pointer constraint and column, and verify every schedule occurrence uses the transaction-side link.                               | Complete | 2026-08-16 |
| TASK-007 | In the new migration, add `unique (household_id, id)` to schedules, replace `transactions_recurring_schedule_id_fkey` with `(household_id, recurring_schedule_id)` referencing schedules on delete restrict, add the paired-metadata and manual-source checks, and verify cross-household and half-linked rows are impossible.                                         | Complete | 2026-08-16 |
| TASK-008 | In the new migration, create `public.recurring_schedule_status`, add and backfill `status`, rename `paused_reason` to `status_reason`, replace `enabled` with the generated compatibility expression `(status = 'active')`, rebuild `recurring_transaction_schedules_due_idx` with the active predicate, and add partial category and subcategory foreign-key indexes. | Complete | 2026-08-16 |
| TASK-009 | In the new migration, create `public.recurring_transaction_schedule_events` with household-scoped RLS and read-only member access, add its schedule and household indexes, and install one private transition helper that validates allowed transitions and inserts exactly one event per status change.                                                               | Complete | 2026-08-16 |
| TASK-010 | In the new migration, install a private transaction trigger that rejects direct recurrence-metadata changes outside protected functions, then verify authenticated table updates cannot set, change, or clear `recurring_schedule_id` or `scheduled_for`.                                                                                                              | Complete | 2026-08-16 |
| TASK-011 | In the new migration, implement `public.convert_transaction_to_recurring_schedule(...)` to lock and validate one unlinked manual transaction, update its submitted transaction fields, insert an active schedule anchored on its posting date, attach it as occurrence zero, and return the schedule UUID atomically.                                                  | Complete | 2026-08-16 |
| TASK-012 | In the new migration, implement `public.save_recurring_transaction_occurrence(...)` with schedule-first locking, old-cadence occurrence-index calculation, exact `this`/`future`/`all` semantics from REQ-006, destination validation, and one transaction boundary, then verify no intermediate template state can commit.                                            | Complete | 2026-08-16 |
| TASK-013 | In the new migration, implement `public.set_recurring_transaction_schedule_status(...)` with member transitions `active` to `paused` or `stopped`, `paused` to `active` or `stopped`, and repaired `blocked` to `active`, reserve entry into `blocked` for internal functions, insert lifecycle events, and verify stopped schedules cannot resume.                    | Complete | 2026-08-16 |
| TASK-014 | In the new migration, rewrite schedule creation and duplicate conversion to produce a canonically linked occurrence-zero row, and retain the existing enabled and delete RPC names only as adapters to the new status APIs, then verify the delete adapter preserves schedule and occurrence rows.                                                                     | Complete | 2026-08-16 |
| TASK-015 | In the new migration, rewrite destination validation and category-deletion handling to transition invalid schedules to `blocked` with a stable reason while preserving rows, then verify a repaired destination can be saved before an explicit member transition back to `active`.                                                                                    | Complete | 2026-08-16 |
| TASK-016 | In the new migration, rewrite `public.process_due_recurring_transaction_schedules(date)` to process only active rows with `FOR UPDATE SKIP LOCKED`, retain unique occurrence insertion and the catch-up cap, return `created_count` and `blocked_count`, block only classified destination failures, and re-raise all unexpected exceptions.                           | Complete | 2026-08-16 |
| TASK-017 | In the new migration, revoke default execution and table mutation privileges and grant only authenticated access to member RPCs, service-role access to the processor, and member select access through RLS, then verify all security-definer functions use empty search paths and schema-qualified references.                                                        | Complete | 2026-08-16 |

### Implementation Phase 3

- GOAL-003: Route transaction creation, conversion, editing, and lifecycle controls through the atomic database contract with one shared recurring form.

| Task     | Description                                                                                                                                                                                                                                                                                | Status   | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| TASK-018 | Update `src/lib/validation.ts` to validate the existing recurrence cadence and interval for regular edits and to reject invalid scope-field combinations, then verify regular income and expense payloads can opt into recurrence.                                                         | Complete | 2026-08-16 |
| TASK-019 | Update `src/app/actions/transactions.ts` so an unlinked edit with recurrence calls `convert_transaction_to_recurring_schedule`, a linked edit calls `save_recurring_transaction_occurrence`, a non-recurring edit keeps the direct update, and no recurring save performs two mutations.   | Complete | 2026-08-16 |
| TASK-020 | Reduce `src/app/actions/recurring-transactions.ts` to pause, resume, and stop status adapters using `set_recurring_transaction_schedule_status`, then verify no application action calls the legacy enabled, delete, or schedule-update RPCs.                                              | Complete | 2026-08-16 |
| TASK-021 | Create `src/components/recurring-schedule-fields.tsx` as the single controlled cadence-and-interval field group used by create, regular edit, and recurring edit states, then verify it contains no mutation, data-fetching, or generic form-framework abstraction.                        | Complete | 2026-08-16 |
| TASK-022 | Update `src/components/transaction-sheet.tsx` to use `RecurringScheduleFields`, show recurrence opt-in for regular rows, retain pause/resume and confirmed stop icons beside cadence for linked rows, enforce scope restrictions from UI-002, and submit one bottom `Save changes` button. | Complete | 2026-08-16 |
| TASK-023 | Update `src/lib/dashboard-read-model.ts` to select schedule `status`, expose status and cadence for every canonically linked occurrence including occurrence zero, and remove runtime dependence on stored `enabled` or `first_occurrence_transaction_id`.                                 | Complete | 2026-08-16 |
| TASK-024 | Regenerate `src/lib/database.types.ts` from the migrated schema and update TypeScript call sites to use the generated RPC, enum, event, and JSON result types without handwritten casts.                                                                                                   | Complete | 2026-08-16 |

### Implementation Phase 4

- GOAL-004: Make the existing Vercel cron adapter report truthful processor outcomes without adding scheduling infrastructure.

| Task     | Description                                                                                                                                                                                                                                               | Status   | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-025 | Update `src/app/api/cron/recurring-transactions/route.ts` to parse the processor result and return `{ ok: true, createdCount, blockedCount }`, log no secrets or financial payloads, and return HTTP 500 when the RPC fails or returns an invalid result. | Complete | 2026-08-16 |
| TASK-026 | Keep `vercel.json` at `0 3 * * *` and document that Vercel may overlap or duplicate invocations while the database unique key and `SKIP LOCKED` provide idempotency, then verify no queue, retry loop, or second scheduler is added.                      | Complete | 2026-08-16 |

### Implementation Phase 5

- GOAL-005: Prove local behavior, apply the migration only to `joint-dev` through the approved workflow, and leave production release separately controlled.

| Task     | Description                                                                                                                                                                                                                                                                                                                                    | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| TASK-027 | Extend `supabase/tests/recurring_schedule_security.sql` with the lineage, constraint, privilege, conversion, scope, lock-order, status-history, stop-preservation, processor-count, classified-block, unexpected-error, catch-up, and idempotency cases in TEST-001 through TEST-007, then verify its pgTAP plan count matches its assertions. | Complete | 2026-08-16 |
| TASK-028 | Add `supabase/tests/recurring_schedule_security.sql` to `package.json` `test:db`, then verify the script still requires `JOINT_DEV_TEST_DB_URL` and does not target production.                                                                                                                                                                | Complete | 2026-08-16 |
| TASK-029 | Update the focused Vitest files in TEST-008 through TEST-012 and run them with Bun, then verify regular conversion, atomic scope saves, shared fields, canonical read mapping, and cron success/failure responses.                                                                                                                             | Complete | 2026-08-16 |
| TASK-030 | Run `bun run format:check`, `bun run lint`, `bun run typecheck`, and `bun run test`, then record any failure with its exact command and distinguish pre-existing failures from changed-file failures.                                                                                                                                          | Complete | 2026-08-16 |
| TASK-031 | Verify `supabase/.temp/project-ref` is exactly `magcvzqnwrwxkhtsfspg`, run `supabase migration list --linked`, `supabase db push --linked --dry-run`, `supabase db push --linked`, and the migration list again against `joint-dev`, then stop without applying if authentication, project identity, or history differs.                       | Complete | 2026-08-16 |
| TASK-032 | After the approved `joint-dev` push, run the focused pgTAP file, inspect Supabase security and performance advisors, regenerate and compare database types, and verify the intended catalog constraints, indexes, policies, grants, functions, and trigger behavior.                                                                           | Complete | 2026-08-16 |
| TASK-033 | Verify the authenticated `/transactions` flow on desktop and mobile for regular expense conversion, regular income conversion, recurring scope edits, pause/resume, stop, and occurrence-zero markers, then record browser proof separately from local and hosted database proof.                                                              | Complete | 2026-08-16 |
| TASK-034 | Leave `.github/workflows/cd.yml`, `joint-prod`, Vercel production, and legacy-adapter removal unchanged until separate explicit release approval and one deployed compatibility interval have completed.                                                                                                                                       | Complete | 2026-08-16 |

## 3. Alternatives

- **ALT-001**: Keep `first_occurrence_transaction_id` beside transaction-side links; rejected because two lineage paths already create ambiguous relations and make occurrence zero invisible to transaction-side reads.
- **ALT-002**: Coordinate schedule and occurrence writes in sequential Server Actions; rejected because an RPC transaction is the smallest boundary that prevents partial commits and lock-order inversion.
- **ALT-003**: Physically delete stopped schedules and copy labels onto transactions; rejected because deletion destroys durable lifecycle meaning and requires duplicated historical metadata.
- **ALT-004**: Use only `enabled` and free-text `paused_reason`; rejected because member pause, terminal stop, and processor block have different transition rules and operational meaning.
- **ALT-005**: Move generation to Vercel Workflow, Redis, a queue, or `pg_cron`; rejected because the existing database processor already owns idempotency and row locking, and no measured throughput problem justifies another system.
- **ALT-006**: Build a generic transaction-form framework or recurring repository layer; rejected because one focused field component plus existing Server Actions and RPCs removes the duplication without speculative abstraction.
- **ALT-007**: Remove legacy columns and RPC names in the same release; rejected because production applies migrations before application deployment and requires a compatibility window.

## 4. Dependencies

- **DEP-001**: PostgreSQL constraints, enums, triggers, transactions, row locks, partial indexes, and RLS supplied by the existing Supabase Postgres project.
- **DEP-002**: Existing `requireCurrentHousehold`, transaction validation, category/payer/Bills-period validation, recurrence date helpers, and generated `Database` types.
- **DEP-003**: Existing Next.js Server Actions, transaction sheet, shadcn/Radix controls, and Lucide icons; no new package is required.
- **DEP-004**: Existing Vercel Cron configuration, `CRON_SECRET`, server-only Supabase service-role key, and `/api/cron/recurring-transactions` route.
- **DEP-005**: Authorized Supabase CLI access to hosted `joint-dev` and the exact project reference `magcvzqnwrwxkhtsfspg` for Phase 5 only.
- **DEP-006**: A separate user-approved production release after the migration and application are verified on `joint-dev`.

## 5. Files

- **FILE-001**: `docs/architecture/recurring-transactions.md` — canonical recurring mechanism and operational ownership.
- **FILE-002**: `docs/architecture/financial-model.md` — durable schedule and occurrence invariants.
- **FILE-003**: `docs/design.md` — transaction-sheet recurrence interaction and accessibility contract.
- **FILE-004**: `docs/superpowers/specs/2026-08-16-convert-transaction-to-recurring-design.md` — approved conversion behavior aligned with the migration.
- **FILE-005**: `supabase/migrations/*_deepen_recurring_transaction_lifecycle.sql` — single forward schema and RPC migration generated in Phase 2.
- **FILE-006**: `supabase/tests/recurring_schedule_security.sql` — database lifecycle, authorization, atomicity, and processor verification.
- **FILE-007**: `package.json` — inclusion of the recurring pgTAP suite in `test:db`.
- **FILE-008**: `src/lib/database.types.ts` — regenerated schema and RPC types.
- **FILE-009**: `src/lib/validation.ts` and `src/lib/validation.test.ts` — recurrence and scope input validation.
- **FILE-010**: `src/app/actions/transactions.ts` and `src/app/actions/transactions.test.ts` — create, convert, and atomic edit routing.
- **FILE-011**: `src/app/actions/recurring-transactions.ts` and `src/app/actions/recurring-transactions.test.ts` — lifecycle status actions.
- **FILE-012**: `src/components/recurring-schedule-fields.tsx` — shared controlled recurrence fields.
- **FILE-013**: `src/components/transaction-sheet.tsx` and `src/components/transaction-sheet.test.tsx` — conversion, scope, save, and management UI.
- **FILE-014**: `src/lib/dashboard-read-model.ts` and `src/lib/dashboard-read-model.test.ts` — canonical schedule projection and status mapping.
- **FILE-015**: `src/app/api/cron/recurring-transactions/route.ts` and `src/app/api/cron/recurring-transactions/route.test.ts` — authenticated processor result adapter.
- **FILE-016**: `vercel.json` — unchanged daily cron schedule verified by Phase 4.
- **FILE-017**: `.github/workflows/cd.yml` — unchanged migration-before-deploy production boundary verified by Phase 5.

## 6. Testing

- **TEST-001**: pgTAP proves occurrence-zero backfill, pointer removal, unique schedule/date identity, composite household ownership, paired recurrence metadata, and manual-source enforcement.
- **TEST-002**: pgTAP proves authenticated direct recurrence-metadata tampering and cross-household links fail while member-owned protected RPCs succeed.
- **TEST-003**: pgTAP proves regular expense and income conversion preserve one existing row as occurrence zero, create one schedule, calculate the next occurrence after the current posting date, and reject already-linked or imported rows.
- **TEST-004**: pgTAP proves `this`, `future`, and `all` semantics, preserved posting dates for future/all, old-cadence index calculation, schedule-first locking, and rollback of all writes after any validation failure.
- **TEST-005**: pgTAP proves allowed status transitions, terminal stop, internal block, one event per transition, member visibility, forbidden direct event writes, and preserved lineage after stop.
- **TEST-006**: pgTAP proves category deletion blocks instead of deletes, corrected destinations can be saved, and only explicit member action resumes a repaired schedule.
- **TEST-007**: pgTAP proves due processing returns exact created/blocked counts, catches up within 366 rows, remains idempotent under repeats, skips locked schedules, blocks classified destination failures, and re-raises unexpected failures.
- **TEST-008**: `src/lib/validation.test.ts` proves cadence intervals and scope-field combinations accept the approved shapes and reject incompatible changes.
- **TEST-009**: `src/app/actions/transactions.test.ts` proves regular conversions and linked edits make exactly one mutation RPC call and never perform the former sequential schedule-plus-transaction writes.
- **TEST-010**: recurring action tests prove pause, resume, and stop call the status RPC with exact states and preserve user-safe errors.
- **TEST-011**: transaction-sheet and read-model tests prove the shared recurrence fields render for create, regular edit, and recurring edit; kind/date scope gating works; controls remain accessible; and occurrence zero maps schedule status and cadence.
- **TEST-012**: cron route tests prove missing or incorrect authorization returns 401, missing server configuration returns 500, valid processing returns exact counts, malformed results return 500, and RPC errors return 500 without leaking secrets.
- **TEST-013**: Repository validation runs `bun run format:check`, `bun run lint`, `bun run typecheck`, and `bun run test`; database validation runs the updated `bun run test:db` only against confirmed `joint-dev`.
- **TEST-014**: Authenticated browser verification covers desktop and mobile conversion and lifecycle flows and is reported separately from code, unit-test, pgTAP, and hosted-schema evidence.

## 7. Risks & Assumptions

- **RISK-001**: Backfill may encounter an inconsistent pointer, existing transaction-side link, or duplicate anchor; the migration must abort before dropping the old column rather than guessing ownership.
- **RISK-002**: PostgreSQL lock-order tests can be timing-sensitive; every lifecycle function must acquire the schedule row before occurrence rows, and a bounded two-session integration check must supplement static SQL review.
- **RISK-003**: A database-first production deploy can run old application code against the new schema; the generated `enabled` column and legacy RPC adapters are mandatory for one deployed compatibility interval.
- **RISK-004**: Catching all processor exceptions would hide operational failures, while re-raising every domain failure would repeatedly fail cron; only enumerated destination failures may transition to `blocked`, and every other exception must surface.
- **RISK-005**: Lifecycle events add durable rows; current household scale makes unbounded retention acceptable, and retention or aggregation must wait for measured growth.
- **RISK-006**: Category and subcategory foreign-key indexes add write cost; the two narrow partial indexes are justified by deletion validation and omit null schedules.
- **ASSUMPTION-001**: Current recurring schedules and preserved first transactions are few enough for one locked transactional backfill during a controlled migration.
- **ASSUMPTION-002**: Existing schedules are intended to preserve their first transaction and use that transaction's posting date as the anchor occurrence.
- **ASSUMPTION-003**: Members may convert both manual income and manual expense rows, but statement-import rows remain non-convertible in this plan.
- **ASSUMPTION-004**: `future` means ungenerated occurrences only; already-generated rows change only under `this` or `all`.
- **ASSUMPTION-005**: A blocked schedule requires destination repair followed by explicit member resume; automatic resume is not approved.
- **ASSUMPTION-006**: One compatibility interval means the migration and compatible application have completed one production release before any follow-up migration removes generated `enabled` or legacy RPC adapters.

## 8. Related Specifications / Further Reading

- [Existing recurring transaction plan](recurring-transaction-schedules.md)
- [Recurring transaction architecture](../architecture/recurring-transactions.md)
- [Financial model](../architecture/financial-model.md)
- [Transaction conversion design](../superpowers/specs/2026-08-16-convert-transaction-to-recurring-design.md)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase API security and RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
