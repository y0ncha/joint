---
goal: Import Hebrew card statements into the shared transaction ledger
version: 1.1
date_created: 2026-07-21
last_updated: 2026-07-21
owner: Joint
status: In progress
tags: [feature, transactions, import, csv, xlsx, supabase, onboarding]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Implement an authenticated CSV/XLSX statement import based on the supplied workbook. A household member uploads one Bank Hapoalim-style card statement, Joint validates it on the server, optionally maps recognized card last-four digits to joined household members, and atomically saves every valid non-zero row to the shared ledger. Unrecognized cards remain unassigned. The import returns a read-only digest of what was saved. Imported transactions remain uncategorized until a separate approved category-assignment design is created.

This plan supersedes the non-persistence decision in `docs/plans/features/transactions-csv-digest.md`. It does not add bank connections, full card numbers, card accounts, automatic categorization, or persistent source files.

## 1. Requirements & Constraints

- **REQ-001**: Accept only `.csv` and `.xlsx` files no larger than 1 MiB. Reject `.xls`, `.xlsm`, password-protected workbooks, unsupported encodings, files with more than 1,000 statement rows, and files with no non-zero statement rows.
- **REQ-002**: Parse uploads only on the server. Do not persist the uploaded file, workbook metadata, bank account number, statement headings, footer text, or ignored columns.
- **REQ-003**: Locate exactly one header row containing the exact Hebrew headers `כרטיס`, `בית עסק`, `תאריך עסקה`, `פירוט`, and `סכום החיוב`. Permit the additional columns and leading/trailing non-transaction rows present in the supplied workbook. Reject a missing or duplicate matching header row.
- **REQ-004**: Read transaction direction and amount only from `סכום החיוב`. Ignore `סכום העסקה`. A positive charge becomes `kind = 'expense'`; a negative charge becomes `kind = 'income'` with `amount = abs(סכום החיוב)`; a zero charge is skipped and counted in the result digest.
- **REQ-005**: Map `בית עסק` to a new `transactions.merchant` value, trim surrounding whitespace, require a non-empty imported merchant, and limit stored merchant text to 200 characters.
- **REQ-006**: Map trimmed `פירוט` to `transactions.note`; map a blank cell to `''`; preserve the existing 500-character note ceiling.
- **REQ-007**: Parse `תאריך עסקה` strictly as a real `DD/MM/YYYY` calendar date and persist it as ISO `YYYY-MM-DD` in `transactions.occurred_on`. Do not use `תאריך החיוב`.
- **REQ-008**: Extract the final four digits from `כרטיס` values such as `ויזה 4548`. Map a value to exactly one joined member when a household mapping exists; otherwise save the transaction with `paid_by = null`.
- **REQ-009**: Store only a member/card mapping containing `household_id`, `user_id`, and four digits. Each joined member has at most one mapping, and a four-digit value belongs to at most one member within a household. Never store a full card number, issuer credential, account identifier, statement-close day, or card balance.
- **REQ-010**: Create an optional card-mapping setup page reachable only after successful household membership. OAuth redirects each newly joined or existing member to `/setup/card`, where the member may save one mapping or skip to `/`. The setup mutation MUST derive user and household identifiers from `requireCurrentHousehold()` and MUST allow only a first-time mapping for the current member.
- **REQ-011**: Members without a mapping MAY use the manual ledger and import statements. Do not add card editing, replacement, deletion, or owner-managed card assignment.
- **REQ-012**: Add `transactions.source` with exactly `manual` and `statement_import` values. Existing and newly created manual transactions use `manual`; imported rows use `statement_import`.
- **REQ-013**: Keep a category mandatory for `manual` transactions. Permit `category_id = null` only when `source = 'statement_import'`. Imported rows MUST be displayed as `Uncategorized`, excluded from category totals, and included normally in balance, income, expense, comparison, and recent-activity calculations.
- **REQ-014**: Category selection, category suggestions, merchant-to-category rules, and bulk categorization are explicitly deferred. The import UI MUST NOT ask for a category or create a fallback category.
- **REQ-015**: Add an optional Merchant field to manual create/edit UI and display merchant in dashboard activity and the transaction ledger. A manual transaction may retain `merchant = ''`.
- **REQ-015a**: `transactions.paid_by` is nullable for both manual and imported transactions. A non-null payer MUST be a joined household member; `null` displays as `Unassigned`. `created_by` remains required and is always the authenticated mutation actor.
- **REQ-016**: Compute a SHA-256 digest of the uploaded bytes with the server runtime's native Web Crypto implementation. Store the digest and physical source-row number only on imported transactions, and enforce uniqueness on `(household_id, import_file_hash, import_row_number)` so retrying the identical file cannot duplicate rows.
- **REQ-017**: Parse and validate the full file, resolve any available card mappings, and perform one batch insert. Any invalid non-zero row, database error, or duplicate-file conflict MUST insert zero rows and return a sanitized error. An unmatched card is valid and becomes unassigned. Do not partially import a statement.
- **REQ-018**: On success, return and render a digest containing imported row count, skipped-zero count, imported income total, imported expense total, earliest transaction date, and latest transaction date.
- **REQ-019**: Use the supplied workbook only as the format contract. Do not copy it or its personal financial contents into the repository, fixtures, snapshots, logs, documentation, or error messages.
- **SEC-001**: Keep uploads and parsing behind authenticated server code. Browser input MUST NOT choose `household_id`, `created_by`, `paid_by`, `source`, import hashes, or source-row numbers.
- **SEC-002**: Enable RLS on the new member-card mapping table. Household members may read mappings for their household; a member may insert only their own mapping after membership; no authenticated user may update or delete mappings through the Data API.
- **SEC-003**: Preserve membership-scoped transaction RLS and database validation of payer membership. Do not add a service-role client, security-bypassing route, browser-visible secret, or authorization claim based on user metadata.
- **SEC-004**: Treat every filename, cell, and parser error as untrusted. Return fixed user-facing error classes with row numbers only; do not echo raw parser exceptions or unescaped cell contents.
- **CON-001**: Update `docs/design.md` before source implementation because imports, card setup, merchant display, and uncategorized rows change the product and interaction contract. Update `docs/architecture/financial-model.md` only after the mechanism is implemented and verified.
- **CON-002**: Applied migrations are immutable. Create a new migration with `bunx supabase migration new add_statement_import`; edit only the CLI-generated `supabase/migrations/<timestamp>_add_statement_import.sql` file.
- **CON-003**: Before migration application, type generation, advisors, or hosted database tests, verify the linked project is `joint-dev` with project ref `magcvzqnwrwxkhtsfspg`. Do not target `joint-prod` or run migration repair.
- **CON-004**: Work only on the user-selected `feature/transactions-csv-digest` branch. Do not create or switch branches, create a worktree, merge, push, deploy, or mutate `joint-prod` without later explicit permission.
- **CON-005**: Use `exceljs@4.4.0` as the one new runtime dependency for CSV and XLSX decoding. Use native Web Crypto for SHA-256, existing Zod for validation, existing shadcn primitives for UI, and Bun for package and project commands.
- **CON-006**: Do not add persistent upload/staging tables, object storage, background jobs, queues, AI labeling, arbitrary bank-format adapters, import-template builders, or generic parser/plugin abstractions.
- **PAT-001**: Implement parser, mapping, import, financial-report, and setup behavior test-first. Keep the parser as one pure server-only module and keep the authenticated mutations in focused Server Actions.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Change the approved product contract and establish failing behavior tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `docs/design.md` before source code. Replace the visible-MVP prohibition on imports/card numbers with the narrow approved contract: optional one last-four mapping per joined member, skippable post-membership `/setup/card`, authenticated CSV/XLSX statement import, unassigned unmatched cards and optional payer attribution for every transaction, persisted uncategorized transactions, Merchant display, exact Hebrew-field mapping, zero-charge skipping, and an import result digest. Preserve the prohibition on full card numbers, bank connections, accounts, transfers, automatic categorization, and stored source files. | Yes | 2026-07-21 |
| TASK-002 | Run `bun add exceljs@4.4.0`; retain the exact version in `package.json` and `bun.lock`. Do not add a second CSV/XLSX, hashing, upload, or validation dependency. | Yes | 2026-07-21 |
| TASK-003 | Add failing parser tests in `src/lib/statement-import.test.ts`. Generate sanitized in-memory CSV and XLSX fixtures with `exceljs`; include workbook preamble, the exact 18-column supplied header order, footer text, two card labels, differing `סכום העסקה` and `סכום החיוב`, positive/negative/zero charges, blank and whitespace-padded `פירוט`, quoted CSV text, UTF-8 BOM, and invalid dates/amounts. Assert REQ-001 through REQ-007 and REQ-019 without committing the supplied workbook. | Yes | 2026-07-21 |
| TASK-004 | Add failing schema/action tests in `src/app/actions/member-card.test.ts` and `src/app/actions/statement-import.test.ts`. Prove member-card setup derives identifiers from the verified context, rejects a second mapping, and handles duplicate last-four values safely. Prove import accepts missing current-user mappings and unknown statement cards as `paid_by = null`, rejects invalid rows, oversized/duplicate files, and database failures; prove success inserts one normalized batch with recognized mapped payers or null, `source = 'statement_import'`, `category_id = null`, merchant/note/date mappings, file hash, physical row number, and the exact digest totals. | Yes | 2026-07-21 |
| TASK-005 | Update failing tests in `src/lib/financial-report.test.ts`, `src/lib/dashboard-data.test.ts`, `src/app/actions/transactions.test.ts`, `src/components/transaction-sheet.test.tsx`, `src/components/transaction-ledger.test.tsx`, and `src/app/(app)/page.test.tsx`. Prove imported uncategorized rows affect household totals but not category totals, render `Uncategorized` and `Unassigned`, display Merchant, and remain editable without forcing category or payer assignment; prove manual creates still require a category but may be unassigned. | Yes | 2026-07-21 |

### Implementation Phase 2

- **GOAL-002**: Add the minimal database model for safe member mapping and idempotent uncategorized imports.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Immediately before any linked command, read `supabase/.temp/project-ref` and require exactly `magcvzqnwrwxkhtsfspg`; also inspect `bunx supabase migration list --linked` and stop if the remote target or ordered history is unexpected. Run `bunx supabase migration new add_statement_import` and use only its generated path. | Yes | 2026-07-21 |
| TASK-007 | In the generated migration, create `public.member_card_mappings` with `household_id uuid NOT NULL`, `user_id uuid NOT NULL`, `last_four text NOT NULL CHECK (last_four ~ '^[0-9]{4}$')`, `created_at timestamptz NOT NULL DEFAULT now()`, primary key `(household_id, user_id)`, foreign key `(household_id, user_id)` to `public.household_members(household_id, user_id)` with `ON DELETE CASCADE`, and unique `(household_id, last_four)`. Enable RLS; grant authenticated `SELECT, INSERT` only; add membership-scoped household SELECT and self-only INSERT policies using `(select auth.uid())`; grant no UPDATE or DELETE capability. | Yes | 2026-07-21 |
| TASK-008 | In the same migration, create `public.transaction_source` as `('manual', 'statement_import')`; alter `transactions.paid_by` to drop `NOT NULL`; add `transactions.source NOT NULL DEFAULT 'manual'`, `merchant text NOT NULL DEFAULT '' CHECK (char_length(merchant) <= 200)`, nullable `import_file_hash text`, and nullable `import_row_number integer`. Replace `transactions_category_required_check` with a constraint requiring a category for `manual` and permitting null only for `statement_import`; require imported rows to have a 64-character lowercase hexadecimal hash and positive row number, require manual rows to have both import fields null, and add a partial unique index on `(household_id, import_file_hash, import_row_number)` for imported rows. | Yes | 2026-07-21 |
| TASK-009 | Replace `public.validate_transaction_category()` in the migration so it returns `NEW` immediately only when `NEW.source = 'statement_import' AND NEW.category_id IS NULL`; otherwise preserve same-household and matching-kind validation. Replace `public.validate_transaction_paid_by()` so it permits null and otherwise preserves payer-membership validation. Preserve existing transaction RLS, positive two-decimal ILS amounts, and all shared-balance behavior. | Yes | 2026-07-21 |
| TASK-010 | Extend `supabase/tests/shared_balance.sql` with member-card table/RLS tests, self-only insert tests, duplicate member/card tests, transaction-source constraints, manual-category enforcement, imported-null-category acceptance, import metadata consistency, duplicate-file-row rejection, payer membership, and cross-household isolation. Update the pgTAP plan count exactly. Confirm tests fail against the pre-migration schema. | Yes | 2026-07-21 |
| TASK-011 | Reverify the linked ref immediately before applying the migration to `joint-dev`; run the migration dry-run and advisors supported by the installed CLI, apply only after the dry-run is clean, regenerate `src/lib/database.types.ts` explicitly from project `magcvzqnwrwxkhtsfspg`, then run `supabase/tests/shared_balance.sql` and `supabase/tests/two_layer_access.sql` against `joint-dev`. Stop on any target mismatch or test failure. | Yes | 2026-07-21 |

### Implementation Phase 3

- **GOAL-003**: Implement deterministic server-side parsing and one-shot atomic import.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Create `src/lib/statement-import.ts` as a server-only module. Export `parseStatementFile({ name, type, bytes })` returning normalized rows and skipped-zero count. Select CSV/XLSX by validated extension plus content signature, use `exceljs` for decoding, find the unique exact header row, enforce the 1 MiB/1,000-row ceilings, parse strict values, use the physical worksheet/CSV row number, extract the final four digits, and produce `{ importRowNumber, cardLastFour, merchant, occurredOn, kind, amount, note }`. Keep error results deterministic and free of raw financial values. | Blocked — Phase 2 migration, hosted application, and generated types are absent. | 2026-07-21 |
| TASK-013 | Create `src/app/actions/member-card.ts` with `saveCurrentMemberCard(previousState, formData)`. Validate exactly four digits with Zod, call `requireCurrentHousehold()`, insert only `{ household_id: context.householdId, user_id: context.userId, last_four }`, translate unique/authorization failures into fixed field/form errors, and revalidate `/setup/card` and `/transactions/import`. Do not implement update or delete. |  |  |
| TASK-014 | Create `src/app/actions/statement-import.ts` with `importStatement(previousState, formData)`. Require a current household, validate one `File`, enforce the byte limit before parsing, compute lowercase SHA-256 with native Web Crypto, reject a hash already present for the household, parse the file, query all `member_card_mappings` for the verified household, build rows using trusted household/current-user identifiers and mapping-derived `paid_by` or null, then execute one Supabase batch insert. Return the REQ-018 digest and revalidate `/`, `/transactions`, and `/categories` only after success. |  |  |
| TASK-015 | Update `src/lib/validation.ts`, `src/app/actions/transactions.ts`, `src/lib/finance-types.ts`, `src/lib/financial-report.ts`, and `src/lib/dashboard-data.ts` for `source`, `merchant`, nullable payer attribution, and nullable imported categories. Manual create MUST still receive a category; update MUST preserve the stored source and allow an imported transaction to remain uncategorized and any transaction to remain unassigned. No manual action may accept source/import metadata from `FormData`. |  |  |

### Implementation Phase 4

- **GOAL-004**: Add the post-membership mapping flow and accessible import/ledger UI using existing components.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Create `src/app/(app)/setup/card/page.tsx` and `src/components/member-card-setup-form.tsx`. Require member context, redirect to `/` when a mapping already exists, and render one `FieldGroup` form for four digits with visible label, privacy copy, validation, pending state, live result, a skip action, and a 44px submit target. After successful insertion or skip, redirect to `/`. Use existing `Card`, `Field`, `Input`, and `Button`; add no shadcn primitive. |  |  |
| TASK-017 | Update `src/app/auth/callback/route.ts` and its tests. Only after `ensurePartnerMembership` returns `joined` or `existing`, redirect to `/setup/card`; the page allows card setup or skipping to `/`. Preserve unmatched sign-out, OAuth error handling, provider checks, and membership as the authorization boundary. |  |  |
| TASK-018 | Create `src/app/(app)/transactions/import/page.tsx` and `src/components/statement-import-form.tsx`. Require member context and render one `.csv,.xlsx` file input regardless of mapping status, explicit text that submission saves transactions and leaves unmatched cards unassigned, supported-header/size guidance, an accessible pending state, row-numbered sanitized errors, and the REQ-018 success digest in an `aria-live` region. Do not render a category control or pre-import client parser. |  |  |
| TASK-019 | Update `src/app/(app)/transactions/page.tsx` to expose an accessible `Import statement` action beside the existing add action. Update `src/components/transaction-sheet.tsx` with optional Merchant input, an `Unassigned` payer option, and imported-null-category edit behavior. Update `src/components/transaction-ledger.tsx` and `src/app/(app)/page.tsx` to show Merchant as the primary description when present, `Uncategorized` for null categories, `Unassigned` for null payers, and an `Imported` text/badge indicator without relying on color. Preserve keyboard row activation and horizontal table usability. |  |  |
| TASK-020 | Complete all tests from TASK-003 through TASK-005 and add focused rendering tests for `/setup/card` skip/setup paths, the OAuth redirect, import-page semantics without a mapping, upload form semantics, sanitized row errors, digest rendering, and 44px/keyboard-accessible controls. Do not add Playwright or another test framework. |  |  |

### Implementation Phase 5

- **GOAL-005**: Verify the entire contract and document only proven behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | After code and hosted database tests pass, update `docs/architecture/financial-model.md` with the implemented `member_card_mappings` boundary, transaction source/category rules, exact imported-field mapping, idempotency ceiling, balance/report behavior, and raw-file non-persistence. Update `docs/architecture.md` only if its system summary or index must change. Update `README.md` and `docs/CONTRIBUTE.md` to replace the blanket import/card prohibition with this narrow supported behavior. |  |  |
| TASK-022 | Run focused Vitest files for statement parsing, member-card setup, import action, OAuth callback, transaction actions, finance reporting, dashboard loading/rendering, transaction sheet/ledger, and import/setup pages. Then run `bun run lint`, `bun run test`, `bun run build`, `git diff --check`, and `bun audit`. Require every command to exit zero or document and resolve an advisory before completion. |  |  |
| TASK-023 | Review the final diff against REQ-001 through REQ-019 and SEC-001 through SEC-004. Confirm the supplied workbook file and its personal financial contents are absent from `git status`, `git diff`, fixtures, logs, and documentation. Report implementation, local checks, `joint-dev` migration/tests, and unverified deployment/authenticated-live behavior separately. Update this plan's task/status fields and add a dated `CHANGELOG.md` entry only when all implementation tasks pass. Wait for explicit implementation approval; do not merge, push, deploy, or target production. |  |  |

## 3. Alternatives

- **ALT-001**: Keep the original read-only digest and never write `transactions`. Rejected because the user explicitly required statement rows to be saved.
- **ALT-002**: Require category assignment before import. Deferred because the user explicitly requested empty categories until category behavior is discussed separately.
- **ALT-003**: Make `category_id` optional for every transaction. Rejected because it weakens the manual-entry invariant; `transactions.source` limits null categories to imported rows.
- **ALT-004**: Add last-four metadata directly to `household_members`. Rejected because granting members self-update access to the authorization table creates unnecessary role/ownership escalation risk; a narrow mapping table isolates card metadata and RLS.
- **ALT-005**: Store full card records or reintroduce account/card models. Rejected because four-digit payer mapping is sufficient and full financial/card modeling remains outside scope.
- **ALT-006**: Parse in the browser or trust a client preview payload. Rejected because imported financial mutations require authoritative server validation.
- **ALT-007**: Persist source files or staging rows to support a preview step. Rejected because one-shot parsing/insertion meets the approved workflow with less sensitive storage and less cleanup infrastructure.
- **ALT-008**: Write custom ZIP/XML and CSV parsers. Rejected because one pinned dependency already handles both requested formats more safely and with less code.

## 4. Dependencies

- **DEP-001**: Explicit user approval of this plan before implementation.
- **DEP-002**: The current user-selected `feature/transactions-csv-digest` branch remains checked out and the working tree remains safe.
- **DEP-003**: Hosted development Supabase project `joint-dev` (`magcvzqnwrwxkhtsfspg`) for migration, type-generation, advisor, and pgTAP verification; production access is not required.
- **DEP-004**: `exceljs@4.4.0`, pinned through `package.json` and `bun.lock`, for server-side CSV/XLSX decoding.
- **DEP-005**: A separate future approved design/plan for assigning categories to imported transactions.

## 5. Files

- **FILE-001**: `docs/design.md` — approved import, card-setup, merchant, and uncategorized UI contract.
- **FILE-002**: `supabase/migrations/<timestamp>_add_statement_import.sql` — CLI-generated member-card mapping, source/merchant/import metadata, constraints, trigger, grants, and RLS migration.
- **FILE-003**: `supabase/tests/shared_balance.sql` — database invariants and cross-household/member-card security tests.
- **FILE-004**: `src/lib/database.types.ts` — regenerated `joint-dev` database types.
- **FILE-005**: `package.json` and `bun.lock` — pinned `exceljs@4.4.0` dependency.
- **FILE-006**: `src/lib/statement-import.ts` and `src/lib/statement-import.test.ts` — pure server-side CSV/XLSX parsing and normalization.
- **FILE-007**: `src/app/actions/member-card.ts`, `src/app/actions/member-card.test.ts`, `src/app/actions/statement-import.ts`, and `src/app/actions/statement-import.test.ts` — authenticated setup and atomic import mutations.
- **FILE-008**: `src/app/(app)/setup/card/page.tsx` and `src/components/member-card-setup-form.tsx` — post-membership one-time last-four setup.
- **FILE-009**: `src/app/(app)/transactions/import/page.tsx` and `src/components/statement-import-form.tsx` — authenticated upload and digest UI.
- **FILE-010**: `src/app/auth/callback/route.ts` and its tests — post-membership card-setup redirect.
- **FILE-011**: `src/lib/validation.ts`, `src/app/actions/transactions.ts`, `src/lib/finance-types.ts`, `src/lib/financial-report.ts`, `src/lib/dashboard-data.ts`, and their tests — source, merchant, nullable imported categories, reporting, and trusted mutation behavior.
- **FILE-012**: `src/components/transaction-sheet.tsx`, `src/components/transaction-ledger.tsx`, `src/app/(app)/transactions/page.tsx`, `src/app/(app)/page.tsx`, and their tests — Merchant/import/Uncategorized presentation and navigation.
- **FILE-013**: `docs/architecture/financial-model.md`, optionally `docs/architecture.md`, `README.md`, `docs/CONTRIBUTE.md`, `CHANGELOG.md`, and this plan — verified documentation and delivery status.

## 6. Testing

- **TEST-001**: Pure parser tests prove the exact Hebrew contract for CSV/XLSX, preamble/footer handling, strict date/amount/card parsing, `סכום החיוב` precedence, negative-to-income mapping, zero skipping, notes, merchants, encoding, and hard limits.
- **TEST-002**: Action tests prove verified household derivation, optional member-card mapping, unassigned unknown-card insertion, one atomic insert, duplicate-file protection, sanitized errors, no raw-file persistence, and exact digest totals.
- **TEST-003**: Database pgTAP tests prove mapping-table RLS, self-only setup, household uniqueness, import metadata consistency, manual category enforcement, imported null-category support, nullable payer attribution with non-null payer membership validation, idempotency, and cross-household isolation.
- **TEST-004**: Financial-report and dashboard tests prove uncategorized imports affect shared totals and comparisons while category totals omit them safely.
- **TEST-005**: Component/page tests prove post-membership setup redirects, upload/setup gating, accessible form states, Merchant and Imported presentation, `Uncategorized` fallback, and preserved keyboard behavior.
- **TEST-006**: Hosted `joint-dev` migration history, advisors, regenerated types, `shared_balance.sql`, and `two_layer_access.sql` all pass after explicit target verification.
- **TEST-007**: `bun run lint`, `bun run test`, `bun run build`, `git diff --check`, and `bun audit` pass before implementation approval.

## 7. Risks & Assumptions

- **RISK-001**: A bank export can change headers or cell types. Mitigation: support only the supplied exact contract, reject drift with row/header errors, and add another format only through a separately approved change.
- **RISK-002**: Last four digits are not globally unique. Mitigation: uniqueness and lookup are household-scoped, and each household has only two members; reject ambiguity before insertion.
- **RISK-003**: A member can mistype their immutable mapping. Mitigation: show the entered four digits in the setup confirmation copy; correction remains an operator/database task until an explicit replacement flow is approved.
- **RISK-004**: Raw-file SHA-256 prevents duplicate retries of identical bytes but does not detect semantically identical data re-exported into different bytes or formats. Mitigation: document this ceiling; add canonical row-level deduplication only if real duplicate imports demonstrate the need.
- **RISK-005**: Imported transactions without categories reduce category-total coverage. Mitigation: label them `Uncategorized`, include them in all non-category financial totals, and defer assignment behavior explicitly rather than inventing categories.
- **RISK-006**: Batch size can exceed server or PostgREST limits. Mitigation: enforce 1 MiB and 1,000 rows, use one insert, and reject before database mutation.
- **RISK-007**: Parser/library vulnerabilities can expose server resources. Mitigation: pin `exceljs@4.4.0`, enforce limits before decode, reject macros/legacy formats, run `bun audit`, and update only through reviewed dependency work.
- **ASSUMPTION-001**: The CSV form has the same exact Hebrew columns and row semantics as the supplied XLSX export.
- **ASSUMPTION-002**: `סכום החיוב` uses a dot decimal separator, at most two decimal places, and no currency symbol; any other representation is invalid.
- **ASSUMPTION-003**: The final four digits at the end of `כרטיס` are the stable payer mapping key; issuer text such as `ויזה` is descriptive only.
- **ASSUMPTION-004**: Any joined household member may import a statement containing mapped or unmapped cards. Imported `created_by` is the importer, `paid_by` is the mapped card owner when available, and is otherwise null.
- **ASSUMPTION-005**: A successful import immediately affects the shared ledger and dashboard; the returned digest is confirmation, not a pre-save preview.

## 8. Related Specifications / Further Reading

- [Original transaction CSV digest roadmap brief](features/transactions-csv-digest.md)
- [Joint design system](../design.md)
- [Joint architecture overview](../architecture.md)
- [Financial model](../architecture/financial-model.md)
- [Shared-balance architecture plan](shared-balance-architecture.md)
- [Application runtime](../architecture/application-runtime.md)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js forms and Server Actions](https://nextjs.org/docs/app/guides/forms)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [Project agent guide](../../AGENTS.md)
