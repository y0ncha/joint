---
goal: Make one shared balance the complete finance architecture
version: 1.0
date_created: 2026-07-17
last_updated: 2026-07-17
owner: Joint
status: Completed
tags: [architecture, refactor, finance, postgres, supabase, deletion]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan implements the P0 architecture recommendation to make Joint's visible one-balance product and its persisted finance model identical. The target model stores one signed opening balance on each household, accepts only income and expense transactions, calculates one shared balance, and deletes the dormant account, credit-card, transfer, card-debt, and account-management implementation. This file is a plan only; no implementation or hosted-environment change is authorized until the user explicitly approves it.

## Execution notes

- 2026-07-17: Started `feature/shared-balance-architecture` from `f742222` after confirming local `main` matched `origin/main`.
- 2026-07-17: Read-only preflight passed in `joint-dev` and `joint-prod`: each has one active bank account with a 9000.00 ILS opening balance, no cards, transfers, or archived accounts, and exact reconciliation of current net balance to the target shared balance. `joint-prod` is behind `joint-dev` in migration history; production remains out of scope until its separate approval gate.
- 2026-07-18: `joint-dev` has one household and no transactions or transfers. The user accepted the historical pre-/post-migration cutoff reconciliation as not applicable for this empty development dataset. Hosted pgTAP passed (14 shared-balance and 42 access assertions); lint, Vitest, and the production build passed. Production remains untouched.
- 2026-07-18: The user approved the verified implementation at TASK-024. This approval does not authorize merging, pushing, deploying, or changing `joint-prod`.
- 2026-07-18: The user approved TASK-025 and confirmed `joint-prod` backup/PITR availability. An incorrect `20260717210731` migration-history entry was repaired before applying the canonical migration. Production pgTAP passed (14 shared-balance and 42 access assertions); its one household has a 9000.00 ILS opening balance, zero transactions, and zero transfers. The deployed production application was verified in an authenticated session: the dashboard and July transaction ledger load successfully with no account-related error.

## 1. Requirements & Constraints

- **REQ-001**: The persisted finance model MUST expose exactly one balance per household and MUST NOT retain multiple accounts, account kinds, account archival, card metadata, card debt, transfer transactions, or account management.
- **REQ-002**: `public.households.opening_balance` MUST be `numeric(12, 2) NOT NULL DEFAULT 0`. It MUST permit negative values because a migrated household's net opening position can be negative.
- **REQ-003**: The post-migration shared balance MUST equal `households.opening_balance + sum(income amounts through the report cutoff) - sum(expense amounts through the report cutoff)`.
- **REQ-004**: Migration of an existing household MUST set `households.opening_balance` to the sum of all non-archived bank opening balances minus the sum of all non-archived credit-card opening balances. This makes the new shared balance equal the old `bankBalance - cardDebt` at every transaction cutoff after transfer rows are removed.
- **REQ-005**: Existing `income` and `expense` rows MUST be preserved with their identifiers, household, amount, date, category, creator, payer, note, and timestamps unchanged. Their `account_id` and `destination_account_id` columns MUST be removed.
- **REQ-006**: Existing `transfer` rows MUST be counted and exported during preflight, then deleted by the ordered migration. Transfers MUST NOT be converted to expenses because their source and destination effects cancel in the net shared-balance formula.
- **REQ-007**: The `public.transaction_kind` enum MUST contain only `income` and `expense` after migration. The `public.account_kind` enum and `public.accounts` table MUST be removed.
- **REQ-008**: Income MUST use an income category; expense MUST use an expense category; every category and payer MUST belong to the transaction household; transaction amounts MUST remain positive ILS values with at most two decimal places.
- **REQ-009**: `buildMonthlyReport` MUST expose `sharedBalance` and MUST NOT expose `bankBalance`, `cardDebt`, account identifiers, destination-account identifiers, or a transfer branch.
- **REQ-010**: The `/accounts` route, account Server Actions, account forms/lists, account validation, and their focused tests MUST be deleted rather than hidden or retained for future use.
- **REQ-011**: The dashboard and transaction ledger MUST preserve the approved visible income, expense, category, payer, date, note, comparison, and recent-activity behavior. This plan MUST NOT add new UI.
- **REQ-012**: Operator owner provisioning MUST write `opening_balance` in the household insert and MUST NOT create an account row.
- **SEC-001**: `household_members` and existing RLS policies MUST remain the sole household authorization boundary. No service-role application path, public privileged RPC, Auth Hook, view, or new authorization table is permitted.
- **SEC-002**: `public.households`, `public.categories`, and `public.transactions` MUST keep RLS enabled. Every application query and mutation MUST derive the household from verified server-side membership.
- **SEC-003**: The replacement transaction validation trigger MUST be `SECURITY INVOKER`, MUST set a fixed `search_path`, and MUST validate category household ownership and category kind. `public.validate_transaction_paid_by()` MUST remain active.
- **DAT-001**: Before applying a migration, both `joint-dev` and `joint-prod` MUST be queried for account counts by household, account kind, archival state, transfer count, transaction count by kind, and the pre-migration `bankBalance - cardDebt` at every distinct transaction date.
- **DAT-002**: If either environment contains an archived account, the implementation MUST stop before creating or applying the migration and set this plan to `On Hold`; archived-account balance semantics are not defined by this plan.
- **DAT-003**: For every household and cutoff inspected in preflight, the independently calculated target value from REQ-003 and REQ-004 MUST equal the existing `bankBalance - cardDebt` to two decimal places. Any mismatch MUST stop execution before schema mutation.
- **DAT-004**: The production migration MUST NOT be applied until the same migration and all database tests pass on `joint-dev`, the development data reconciliation is exact, and a current production backup or point-in-time recovery capability is confirmed.
- **CON-001**: Applied files in `supabase/migrations/` are immutable. Create one new migration with `bunx supabase migration new align_shared_balance`; use the CLI-generated path `supabase/migrations/<timestamp>_align_shared_balance.sql` and do not invent a timestamp.
- **CON-002**: Use hosted `joint-dev` for development database work. Do not create or use a local or disposable Supabase instance.
- **CON-003**: Do not apply any migration to `joint-prod`, deploy, merge, or push without the separate approvals required by `AGENTS.md`.
- **CON-004**: Regenerate `src/lib/database.types.ts` from the migrated `joint-dev` schema. Do not edit generated types by hand.
- **CON-005**: Do not introduce a ledger abstraction, account compatibility adapter, feature flag, dual-read period, second balance table, new dependency, or speculative migration path back to multiple accounts.
- **GUD-001**: Update `docs/design.md` and `AGENTS.md` to the approved one-balance product contract before implementation code. Update architecture records only after the mechanism is implemented and verified.
- **GUD-002**: Keep the implementation on the current checkout until this plan is approved. After approval, follow the branch and working-tree gates in `AGENTS.md` using `feature/shared-balance-architecture`.
- **PAT-001**: Use test-first development for the migration arithmetic, transaction invariants, report calculation, and Server Action behavior.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Freeze the one-balance contract and prove that hosted data can be migrated without ambiguous archival semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Confirm the checkout is safe under `AGENTS.md`, create `feature/shared-balance-architecture` only after explicit plan approval, and record the starting commit and clean/dirty state in this plan's execution notes. Do not carry unrelated changes. | Yes | 2026-07-17 |
| TASK-002 | Update `docs/design.md` and `AGENTS.md` before implementation code: replace bank/card/transfer language with one shared balance, income, and expense; define the shared balance formula from REQ-003; state that a shared balance may be negative; keep multiple accounts, cards, and transfers outside the MVP. | Yes | 2026-07-17 |
| TASK-003 | Run read-only SQL against `joint-dev` and `joint-prod` that returns, per household, total accounts, bank accounts, credit-card accounts, archived accounts, each account opening value, transaction counts by kind, and transfer identifiers. Export the result with environment name and query timestamp. Stop and set status `On Hold` if DAT-002 fails. | Yes | 2026-07-17 |
| TASK-004 | Run a read-only reconciliation query in each environment for every distinct transaction cutoff. Calculate the current bank balance and card debt using the existing rules and calculate the target shared balance using REQ-003 and REQ-004. Require an exact numeric(12,2) match for every row; stop before migration creation if any row differs. | Yes | 2026-07-17 |
| TASK-005 | Verify current Supabase migration history, Postgres version, `public.accounts`/`public.transactions` grants and RLS, available backup or point-in-time recovery for `joint-prod`, and current Supabase breaking changes relevant to Postgres migrations. Record results without changing either project. | | |

### Implementation Phase 2

- GOAL-002: Add failing database and domain checks that define the complete target model before changing production code.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create `supabase/tests/shared_balance.sql` against the target schema. Add pgTAP fixtures with a signed household opening balance plus income and expense transactions. Assert shared-balance arithmetic, preserved income/expense fields, absence of `accounts`, `account_kind`, account columns, card metadata, and transfer support, and exactly two `transaction_kind` values. Assert cross-household categories, mismatched category kinds, and non-member payers fail. Keep old-to-new data conversion proof in the read-only reconciliation queries from TASK-004 and TASK-014, where both schemas' values are available. | Yes | 2026-07-17 |
| TASK-007 | Rewrite `src/lib/financial-report.test.ts` first for `buildMonthlyReport({ openingBalance, categories, transactions, month, asOfDate })`. Preserve month cutoffs, current-month partial comparisons, three-month expected income, category sorting/fallback, and recent-transaction ordering. Add one focused case proving `sharedBalance = openingBalance + income - expenses`; remove every card, transfer, and account fixture/assertion. Confirm the focused test fails before implementation. | Yes | 2026-07-17 |
| TASK-008 | Rewrite `src/app/actions/transactions.test.ts` first so create/update insert only household, creator, payer, kind, amount, date, category, and note; assert no account query occurs; preserve membership-derived ownership, payer validation, household-scoped update/delete, sanitized failures, and transfer rejection at the validation boundary. Confirm the focused test fails before implementation. | Yes | 2026-07-17 |
| TASK-009 | Update `src/lib/dashboard-data.test.ts`, `src/app/(app)/page.test.tsx`, `src/app/(app)/transactions/page.test.tsx`, `src/components/transaction-ledger.test.tsx`, and `src/components/transaction-sheet.test.tsx` fixtures to the target types. Assert dashboard loading reads `households.opening_balance`, returns `report.sharedBalance`, and contains no setup-required account state. | Yes | 2026-07-17 |

### Implementation Phase 3

- GOAL-003: Apply one ordered, reversible-by-backup schema migration to `joint-dev` and prove exact data reconciliation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Run `bunx supabase migration new align_shared_balance`. In the generated `supabase/migrations/<timestamp>_align_shared_balance.sql`, add nullable `public.households.opening_balance numeric(12,2)`, populate it with `coalesce(sum(case when accounts.kind = 'bank' then accounts.opening_balance else -accounts.opening_balance end) filter (where accounts.archived_at is null), 0)`, then set `NOT NULL` and `DEFAULT 0`. Add an explicit migration exception if any archived account exists. | | |
| TASK-011 | In the same migration transaction, delete `transfer` rows; drop `transactions_validate_links` and `public.validate_transaction_links()`; remove the transaction shape check, `transactions_account_occurred_on_idx`, `destination_account_id`, and `account_id`; replace `public.transaction_kind` through a temporary enum containing only `income` and `expense`; add a check requiring non-null `category_id`; and create a `SECURITY INVOKER` category-validation trigger that enforces household ownership and matching category kind. Preserve `transactions_validate_paid_by`. | | |
| TASK-012 | In the same migration transaction, drop `public.accounts` and `public.account_kind`. Do not preserve compatibility views, aliases, old enum values, card metadata, account grants, account RLS policies, or account triggers. Include postconditions that raise an exception unless every household has a non-null opening balance and every remaining transaction is income or expense with a category. | | |
| TASK-013 | Apply the ordered migration to `joint-dev` only. Regenerate `src/lib/database.types.ts` from `joint-dev`. Run `supabase/tests/shared_balance.sql` and the existing `supabase/tests/two_layer_access.sql`; update only the account fixture in `two_layer_access.sql` to use `households.opening_balance` and account-free transaction inserts while preserving all access assertions. | | |
| TASK-014 | Re-run the Phase 1 reconciliation on `joint-dev`. Require row counts for income/expense to match the preflight export, transfer count to be zero, deleted transfer count to match the export, and every post-migration `opening_balance + income - expenses` cutoff to equal the exported pre-migration `bankBalance - cardDebt`. Stop implementation on any mismatch. | Yes — not applicable; accepted by user because `joint-dev` has no transactions | 2026-07-18 |
| TASK-015 | Run Supabase security and performance advisors on `joint-dev`. Resolve only findings introduced by this migration; document unrelated pre-existing findings without expanding scope. Verify RLS remains enabled and household membership still isolates households through the Data API. | | |

### Implementation Phase 4

- GOAL-004: Delete the dormant application surface and reduce reporting and mutation code to the one-balance model.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Delete `src/app/(app)/accounts/page.tsx`, `src/app/actions/accounts.ts`, `src/app/actions/accounts.test.ts`, `src/components/account-form.tsx`, `src/components/account-list.tsx`, and `src/components/account-list.test.tsx`. Remove `accountSchema`, account-only helpers, and account tests from `src/lib/validation.ts` and `src/lib/validation.test.ts`. | | |
| TASK-017 | In `src/lib/finance-types.ts`, delete `AccountRow` and `accountFromRow`; map transactions without `accountId` or `destinationAccountId`. In `src/lib/financial-report.ts`, delete `ReportAccount`, account maps, per-account balances, transfer logic, and `cardDebt`; narrow `ReportTransaction.kind` to `income \| expense`; add `openingBalance` input and return `sharedBalance` using REQ-003. | | |
| TASK-018 | In `src/lib/dashboard-data.ts`, replace the accounts query with `public.households.select("opening_balance").eq("id", household.householdId).single()`, remove account mapping and `setupRequired`, and call `buildMonthlyReport` with the numeric opening balance. Preserve concurrent category, transaction, member, and claims loading and the existing generic data-load error boundary. | | |
| TASK-019 | In `src/app/actions/transactions.ts`, delete `getSharedAccountId` and its setup error paths. Create and update transactions without `account_id` or `destination_account_id`; preserve form validation, verified household/creator derivation, payer membership validation, household-scoped writes, error sanitization, and existing revalidation paths. | | |
| TASK-020 | In `src/app/(app)/page.tsx`, remove account-name mapping and the setup-required branch. Render recent activity category names directly because every transaction has a category. Use `report.sharedBalance` wherever the shared balance is presented and preserve all existing accessible income, outgoing, category, comparison, and activity UI. In `src/components/transaction-ledger.tsx` and `src/components/transaction-sheet.tsx`, consume the narrowed income/expense transaction type without compatibility branches. | | |
| TASK-021 | Update `docs/architecture/financial-model.md`, `docs/architecture/application-runtime.md`, `docs/architecture/operator-owner-provisioning.md`, `docs/architecture.md`, and `README.md` only after code and database verification. Describe the implemented household opening balance, two transaction directions, formula, migration semantics, membership/RLS boundary, and operator insert. Remove stale references to `src/lib/account-balances.ts`, account management, cards, transfers, account provisioning, and future-ready account foundations. | | |

### Implementation Phase 5

- GOAL-005: Verify the complete deletion, obtain implementation approval, and keep production changes separately gated.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Run `rg -n "credit_card|transfer|cardDebt|card_debt|account_kind|accountSchema|accountFromRow|destination_account_id|destinationAccountId|/accounts|from\\(\\\"accounts\\\"\\)" src supabase docs README.md AGENTS.md --glob '!docs/plans/shared-balance-architecture.md'`. Require zero active-code/schema/contract matches; allow only immutable historical migrations and clearly historical completed-plan evidence. | Yes — remaining matches are immutable migrations, roadmap/history, and negative tests | 2026-07-18 |
| TASK-023 | Run the focused pgTAP and Vitest checks from Phases 2 and 3, then `bun run lint`, `bun run test`, and `bun run build`. Require all commands to exit zero and `git diff --check` to report no whitespace errors. | Yes | 2026-07-18 |
| TASK-024 | Present the diff, deleted line/file count, hosted `joint-dev` migration evidence, reconciliation results, advisor results, and remaining production risk. Wait for explicit implementation approval; do not merge, push, deploy, or modify `joint-prod`. | Yes — implementation approved by user | 2026-07-18 |
| TASK-025 | After separate explicit production approval, re-run the Phase 1 production preflight against the unchanged production schema and compare it with the saved export. If unchanged and all gates still pass, apply the ordered migration to `joint-prod`, run post-migration reconciliation and database tests, deploy through the approved Vercel flow, and verify the live shared-balance path. Any drift or failed assertion MUST abort before deployment. | Yes — production migration/reconciliation/pgTAP passed; deployed authenticated dashboard and transaction ledger verified | 2026-07-18 |

## 3. Alternatives

- **ALT-001**: Keep the current account/card/transfer foundation. Rejected because it preserves a speculative model across schema, actions, reporting, types, and tests that the visible product does not use.
- **ALT-002**: Delete only `/accounts` and its components. Rejected because multiple accounts, transfer links, card debt, first-bank selection, and divergent reporting semantics would remain active below the UI.
- **ALT-003**: Retain one row in `public.accounts` per household with a unique household constraint. Rejected because after account kind, name, archival, card metadata, transfer routing, and account management are removed, the row contains only an opening number and adds a join plus an existence/cardinality problem without an independent domain responsibility.
- **ALT-004**: Keep transfer rows as zero-effect historical records. Rejected because the target transaction kind and visible ledger have only income and expense; retaining a third kind would preserve compatibility branches throughout generated types and reporting.
- **ALT-005**: Convert transfers into expenses. Rejected because card purchase expenses already record the spending; conversion would double-count outgoings and reduce the migrated net balance twice.
- **ALT-006**: Add a compatibility view or dual-read feature flag. Rejected because there is one application consumer and one coordinated migration; compatibility infrastructure would prolong the obsolete interface without reducing the required production preflight.

## 4. Dependencies

- **DEP-001**: Explicit user approval of this plan before branch creation or implementation.
- **DEP-002**: Read-only access to `joint-dev` and `joint-prod` for preflight SQL and migration-history inspection.
- **DEP-003**: Supabase CLI invoked through Bun for migration creation, hosted migration operations, database tests, type generation, and advisors; discover exact current commands with `bunx supabase --help` before execution.
- **DEP-004**: A current production backup or point-in-time recovery capability confirmed before the destructive production migration.
- **DEP-005**: Existing Vitest, Next.js, TypeScript, Zod, Supabase SSR, and pgTAP dependencies already present in the repository. No new package is required.
- **DEP-006**: Separate implementation, production-migration, merge, push, and deployment approvals required by `AGENTS.md`.

## 5. Files

- **FILE-001**: `docs/plans/shared-balance-architecture.md` — source implementation plan and execution status.
- **FILE-002**: `docs/design.md` — approved one-balance product and interaction contract.
- **FILE-003**: `AGENTS.md` — repository mission and finance invariants.
- **FILE-004**: `supabase/migrations/<timestamp>_align_shared_balance.sql` — CLI-generated ordered data/schema migration.
- **FILE-005**: `supabase/tests/shared_balance.sql` — one-balance schema, conversion, invariant, and RLS tests.
- **FILE-006**: `supabase/tests/two_layer_access.sql` — account-free financial fixture while preserving access tests.
- **FILE-007**: `src/lib/database.types.ts` — generated target schema types.
- **FILE-008**: `src/lib/finance-types.ts` — account-free row mapping.
- **FILE-009**: `src/lib/financial-report.ts` and `src/lib/financial-report.test.ts` — one-direction reporting and focused checks.
- **FILE-010**: `src/lib/dashboard-data.ts` and `src/lib/dashboard-data.test.ts` — household opening-balance query and dashboard assembly.
- **FILE-011**: `src/lib/validation.ts` and `src/lib/validation.test.ts` — income/expense, category, partner, and monetary validation only.
- **FILE-012**: `src/app/actions/transactions.ts` and `src/app/actions/transactions.test.ts` — account-free authenticated mutations.
- **FILE-013**: `src/app/(app)/page.tsx`, `src/app/(app)/page.test.tsx`, `src/app/(app)/transactions/page.tsx`, and `src/app/(app)/transactions/page.test.tsx` — target report fixtures and shared-balance rendering.
- **FILE-014**: `src/components/transaction-ledger.tsx`, `src/components/transaction-ledger.test.tsx`, `src/components/transaction-sheet.tsx`, and `src/components/transaction-sheet.test.tsx` — narrowed transaction domain consumption.
- **FILE-015**: `src/app/(app)/accounts/page.tsx`, `src/app/actions/accounts.ts`, `src/app/actions/accounts.test.ts`, `src/components/account-form.tsx`, `src/components/account-list.tsx`, and `src/components/account-list.test.tsx` — files to delete.
- **FILE-016**: `docs/architecture/financial-model.md`, `docs/architecture/application-runtime.md`, `docs/architecture/operator-owner-provisioning.md`, `docs/architecture.md`, and `README.md` — post-verification implemented architecture and setup documentation.

## 6. Testing

- **TEST-001**: `supabase/tests/shared_balance.sql` proves the conversion formula, removal of transfer/account structures, two-value transaction enum, category/payer constraints, and household RLS isolation.
- **TEST-002**: `supabase/tests/two_layer_access.sql` proves membership-only authorization still protects account-free household financial data and partner removal preserves transaction history.
- **TEST-003**: `src/lib/financial-report.test.ts` proves shared-balance arithmetic, month cutoffs, partial-month comparisons, expected income, category totals, archived-category fallback, and recent ordering with only income and expense.
- **TEST-004**: `src/app/actions/transactions.test.ts` proves trusted identifiers, payer validation, account-free inserts/updates, household-scoped writes, transfer rejection, and sanitized errors.
- **TEST-005**: `src/lib/dashboard-data.test.ts` proves the household opening balance is loaded once, no account query occurs, and the report receives the numeric value.
- **TEST-006**: Page and component tests prove the existing accessible transaction composer/ledger/dashboard behavior consumes the narrowed types and has no account setup or transfer/card surface.
- **TEST-007**: Preflight and post-migration SQL reconciliation proves every migrated cutoff equals the former `bankBalance - cardDebt`, income/expense row counts are unchanged, and only exported transfer rows are deleted.
- **TEST-008**: `bun run lint`, `bun run test`, `bun run build`, `git diff --check`, the cleanup `rg` gate, Supabase advisors, and hosted Data API isolation checks all pass before implementation approval.

## 7. Risks & Assumptions

- **RISK-001**: The migration intentionally changes the named balance from bank-only cash to net shared position. Mitigation: make the formula explicit in `docs/design.md` and `AGENTS.md` before code and reconcile it to the former `bankBalance - cardDebt` at every cutoff.
- **RISK-002**: Archived accounts have ambiguous inclusion rules in the existing report. Mitigation: DAT-002 blocks implementation instead of guessing or losing history.
- **RISK-003**: A production project may change after preflight. Mitigation: re-run the complete read-only preflight immediately before migration and abort on any drift.
- **RISK-004**: Dropping the account foreign keys and validation trigger could weaken transaction integrity. Mitigation: replace them in the same transaction with category household/kind validation, retain payer validation, and prove RLS and invariant failures in pgTAP.
- **RISK-005**: Removing an enum value requires replacing the PostgreSQL enum type rather than deleting a label in place. Mitigation: perform the type swap inside the single migration transaction after transfer deletion and assert no unsupported value remains.
- **RISK-006**: Generated types or stale fixtures may keep the obsolete model compiling indirectly. Mitigation: regenerate from `joint-dev`, run the explicit zero-match cleanup gate, and run the full build.
- **ASSUMPTION-001**: `joint-dev` and `joint-prod` are the only hosted database environments in scope.
- **ASSUMPTION-002**: Credit-card opening balances represent positive debt, so subtracting them from bank opening balances produces the correct net opening position.
- **ASSUMPTION-003**: Transfer rows represent bank-to-card settlement only and therefore have zero effect on net position; the existing database trigger enforces this for all stored transfers.
- **ASSUMPTION-004**: The account management route is dormant and absent from primary navigation; deleting it does not remove an approved visible workflow.
- **ASSUMPTION-005**: No external integration reads `public.accounts`, `account_kind`, `transactions.account_id`, `transactions.destination_account_id`, or the `transfer` enum value. Phase 1 MUST verify database grants and known consumers before mutation.

## 8. Related Specifications / Further Reading

- [`docs/design.md`](../design.md)
- [`docs/architecture.md`](../architecture.md)
- [`docs/architecture/financial-model.md`](../architecture/financial-model.md)
- [`docs/architecture/application-runtime.md`](../architecture/application-runtime.md)
- [`docs/architecture/operator-owner-provisioning.md`](../architecture/operator-owner-provisioning.md)
- [`docs/plans/shared-budget-mvp.md`](shared-budget-mvp.md)
- [`docs/plans/two-layer-access.md`](two-layer-access.md)
- P0 source review: `file:///var/folders/8v/b97bxm4x7sz18sm1pkthm87r0000gn/T/architecture-review-20260717-171338.html`
- [Supabase changelog breaking changes](https://supabase.com/changelog?tags=breaking-change)
