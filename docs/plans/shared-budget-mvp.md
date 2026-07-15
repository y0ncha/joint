---
goal: Complete the development shared-household budget MVP
version: 2.0
date_created: 2026-07-14
last_updated: 2026-07-14
owner: Joint
status: 'In progress'
tags: [feature, mvp, finance, supabase, rls]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Complete the Joint MVP in the development Supabase environment. Authentication, household creation, and invitation acceptance already exist. This plan delivers a single visible shared-balance setup, category, income/expense transaction, reporting, settings, and dashboard behavior, then verifies the full two-person workflow. The existing accounts schema remains as internal/future infrastructure, but account management, credit-card debt, and transfers are not visible MVP features. It explicitly excludes Vercel deployment and production Supabase setup.

## 1. Requirements & Constraints

### MVP coverage

| ID | MVP capability | Current state | Completion evidence |
| --- | --- | --- | --- |
| REQ-001 | Google-authenticated shared household for two people | Implemented | Existing callback, onboarding, household action, and invitation-RLS tests remain passing. |
| REQ-002 | Owner creates a shareable, expiring invite link; the manually authorized Google account signs in through Supabase Auth and joins exactly one household | Partially implemented | Owner UI creates and copies `/invite/<token>`; anonymous invite route preserves the token through Supabase Google OAuth; matching invitee reaches the existing RLS-backed acceptance form. |
| REQ-003 | Owner creates a household with an initial shared balance | Missing | Onboarding creates the household and one internal shared-balance bank account; `/accounts` is not visible in MVP navigation. |
| REQ-004 | Members create, edit, archive, and view household income/expense categories | Missing | Category actions and `/categories` route persist category kind and archived state. |
| REQ-005 | Members log, edit, delete, and browse manual income and expenses | Missing | Server Actions, transaction composer, and `/transactions` ledger mutate and render RLS-scoped income/expense rows only. |
| REQ-006 | Dashboard reports selected-month income, outgoings, category spending, recent activity, shared balance, and simple visual summaries | Missing | `src/app/page.tsx` contains no fixture amounts or fixture arrays and renders `DashboardData` from Supabase. |
| REQ-007 | Data is authorized exclusively by membership RLS | Partially implemented | Two ordinary authenticated test users cannot read or mutate each other's household data. |

- **FIN-001**: Amounts are positive ILS values with at most two decimal places. Never store a signed amount.
- **FIN-002**: Income uses the internal shared-balance account and an income category. Expense uses the same internal shared-balance account and an expense category.
- **FIN-003**: Transfers and credit-card debt are not visible MVP concepts. Existing schema support remains only as future-ready infrastructure.
- **FIN-004**: The headline shared balance is the balance of the internal shared-balance account as of the selected month's final day.
- **FIN-005**: A month is a `YYYY-MM` search parameter. Monthly income, expenses, category totals, and recent activity include only rows whose `occurred_on` falls within that month; balance calculation includes rows on or before that month's final day.
- **SEC-001**: Every persistent mutation is an authenticated Server Action using `getClaims()` and membership-derived IDs. Browser input must never choose `household_id`, `created_by`, or role.
- **SEC-002**: Do not introduce a Supabase service-role key, public privileged RPC, or browser mutation path. Keep membership RLS as the authorization boundary.
- **SEC-003**: Add schema changes only as a new ordered `supabase/migrations/*.sql` file. Regenerate `src/lib/database.types.ts` after each applied migration.
- **SEC-004**: Do not use Supabase Auth administrative invite methods or a service-role key. The Google OAuth user identity and invitation-email RLS policy remain the only identity and invitation authorization inputs.
- **UI-001**: Use the semantic tokens in `src/app/globals.css`, owned shadcn components, English text, `₪`, and `DD/MM/YYYY`. Do not add arbitrary colors, dark mode, nested glass cards, or image backgrounds.
- **UI-002**: Use `ToggleGroup` for income/expense, a desktop `Sheet` and full-height mobile panel for transaction entry, and `AlertDialog` for destructive confirmation.
- **A11Y-001**: All controls must support keyboard use, visible focus, and 44px mobile targets. Category reporting must include a labelled text/table alternative; color cannot be its only meaning.
- **CON-001**: Preserve the current App Router/Supabase SSR structure. Default to Server Components; isolate browser state and form interaction in explicit client components.
- **CON-002**: Use Bun commands only. Do not introduce npm files or deploy/configure Vercel or production Supabase in this plan.
- **CON-003**: Do not add visible multi-account management, transfers, card debt, budgets, recurring transactions, imports, labels, attachments, bank/card credentials, card numbers, statements, or audit-history UI.

## 2. Implementation Steps

### Implementation Phase 1 — Preserve the completed identity and authorization foundation

- **GOAL-001**: Keep the verified Google OAuth, first-household creation, and RLS invitation-acceptance foundation intact while adding the only missing invite-link navigation seam.
- **Dependencies**: None.
- **Completion criteria**: The existing auth/onboarding test files pass; an anonymous visitor to `/invite/<token>` returns from Google sign-in to `/onboarding?token=<token>`; no external `next` destination is accepted.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Retain `src/app/auth/callback/route.ts:6-30`, `src/app/actions/household.ts:33-91`, `src/lib/household.ts:11-37`, and the ordered invitation migrations as the completed OAuth, one-household, and invite-acceptance implementation. Do not recreate this behavior. | ✅ | 2026-07-14 |
| TASK-002 | Modify `src/app/login/page.tsx` to read `next` from `useSearchParams()`, reject values that are not a single-origin relative path, and append the approved value to the Supabase OAuth callback URL. Add `src/app/login/page.test.tsx` cases for internal-token preservation and external-path rejection. | ✅ | 2026-07-14 |
| TASK-003 | Create `src/app/invite/[token]/page.tsx` as a Server Component. For a signed-in member, redirect to `/`; for a signed-in non-member, redirect to `/onboarding?token=<encoded token>`; for an anonymous user, redirect to `/login?next=<encoded /onboarding?token=...>`. Add `src/app/invite/[token]/page.test.tsx` for all three paths. | ✅ | 2026-07-14 |
| TASK-004 | Run `bun run test -- src/app/auth/callback/route.test.ts src/app/actions/household.test.ts src/app/login/page.test.tsx src/app/invite/'[token]'/page.test.tsx`; require exit code 0 before Phase 2. | ✅ | 2026-07-14 |

### Implementation Phase 2 — Define finance contracts before persistence

- **GOAL-002**: Establish deterministic typed validation and reporting contracts that preserve every accounting invariant before adding UI or mutation code.
- **Dependencies**: Phase 1 complete.
- **Completion criteria**: Unit tests cover every permitted and rejected transaction shape, correct selected-month reporting, balance-as-of-month-end behavior, and transfer exclusion.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-005 | Create `src/lib/finance-types.ts` with typed row-to-domain mappers for `accounts`, `categories`, and `transactions` from `Database["public"]["Tables"]`. Convert Supabase numeric strings with `Number()` and reject non-finite values. |  |  |
| TASK-006 | Create `src/lib/validation.ts` and `src/lib/validation.test.ts`. Export `accountSchema`, `categorySchema`, `invitationSchema`, and a Zod discriminated `transactionSchema`. Require trimmed 1–80-character names, positive two-decimal ILS amounts, `YYYY-MM-DD` dates, and the FIN-002 account/category combinations. | In progress | 2026-07-14 |
| TASK-007 | Create `src/lib/financial-report.ts` and `src/lib/financial-report.test.ts`. Export `buildMonthlyReport({ accounts, categories, transactions, month }): MonthlyReport`; use rows through month end for account balances, rows in the month for income/expenses/category totals/recent activity, sort activity by `occurred_on DESC, created_at DESC`, and exclude archived records only from selectable active lists, never historical reporting. | ✅ | 2026-07-14 |
| TASK-008 | Modify `src/lib/account-balances.ts` and `src/lib/account-balances.test.ts` only as needed to share the Phase 2 domain types while preserving its existing rejection behavior for unknown accounts, card income, and invalid transfer direction. Add an assertion that multiple bank/card accounts aggregate correctly. |  |  |
| TASK-009 | Run `bun run test -- src/lib/account-balances.test.ts src/lib/validation.test.ts src/lib/financial-report.test.ts`; require exit code 0 before Phase 3. |  |  |

### Implementation Phase 3 — Add authenticated household mutations

- **GOAL-003**: Provide one typed Server Action boundary for all remaining persistent household mutations.
- **Dependencies**: Phase 2 complete.
- **Completion criteria**: Action tests prove membership-derived IDs override browser input, validation errors are field-addressable, updates/deletes cannot cross household boundaries, and all mutations revalidate relevant routes.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-010 | Create `src/app/actions/result.ts` with `ActionResult = { status: "success"; data?: Record<string, string> } \| { status: "error"; formError: string; fieldErrors: Record<string, string> }`, `validationError`, and a sanitized `databaseError`. Reuse this type from `src/app/actions/household.ts` without changing its public user-facing errors. |  |  |
| TASK-011 | Extend `src/lib/household.ts` with `requireCurrentHousehold(): Promise<CurrentHousehold & { userId: string }>` that uses `getClaims()` and throws/returns a handled unauthenticated result before any query. All Phase 3 actions must call it exactly once per request. Add focused tests. |  |  |
| TASK-012 | Create `src/app/actions/accounts.ts` and `src/app/actions/accounts.test.ts` with `createAccount`, `updateAccount`, and `archiveAccount`. Derive `household_id` from `requireCurrentHousehold`; constrain update/archive by both `id` and `household_id`; prohibit archive when a transaction references the account; return a form error explaining that referenced accounts must remain available for history. |  |  |
| TASK-013 | Create `src/app/actions/categories.ts` and `src/app/actions/categories.test.ts` with `createCategory`, `updateCategory`, and `archiveCategory`. Members may archive categories with history; archive sets `archived_at`, and the dashboard/composer excludes archived categories only from new-entry choices. |  |  |
| TASK-014 | Create `src/app/actions/invitations.ts` and `src/app/actions/invitations.test.ts` with owner-only `createInvitation`. Validate a normalized lowercase email, insert the existing seven-day invitation row, derive `${origin}/invite/${token}`, and return it in `ActionResult.data.invitationUrl`. The owner copies the URL to the invited person. The invited Google account must be manually authorized in the Google Cloud OAuth project's test-user list, then signs in through Supabase Auth; no provider secret, Auth admin API, or public invite-creation API is added. |  |  |
| TASK-015 | Create `src/app/actions/transactions.ts` and `src/app/actions/transactions.test.ts` with `createTransaction`, `updateTransaction`, and `deleteTransaction`. Re-validate the discriminated form data on every call; use server-derived household/user IDs; set transfer category to `null`; and constrain update/delete by both transaction ID and household ID. Revalidate `/`, `/transactions`, `/accounts`, and `/categories` after successful mutation. |  |  |
| TASK-016 | Run `bun run test -- src/app/actions`; require exit code 0 before Phase 4. |  |  |

### Implementation Phase 4 — Build account, category, invitation, and transaction-log surfaces

- **GOAL-004**: Let both household members manage setup data and browse the persistent transaction history through accessible routes.
- **Dependencies**: Phase 3 complete.
- **Completion criteria**: Each route renders only RLS-scoped data, supports its specified mutation flow, and reports truthful empty/error states without fixture finance values.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-017 | Create `src/components/app-navigation.tsx` and replace the button-only navigation in `src/app/page.tsx:42-57` and `src/app/page.tsx:177-181` with keyboard-accessible `Link` elements for `/`, `/transactions`, `/accounts`, `/categories`, and `/settings`. Preserve the desktop rail and mobile bottom navigation visual contract. |  |  |
| TASK-018 | Create `src/app/(app)/accounts/page.tsx`, `src/components/account-form.tsx`, and associated tests. Query current-household accounts server-side; render add/edit/archive actions; require bank/card kind, name, opening balance, and opening date; use `AlertDialog` for archive confirmation and render the Phase 3 referenced-account error. |  |  |
| TASK-019 | Create `src/app/(app)/categories/page.tsx`, `src/components/category-form.tsx`, and associated tests. Query current-household categories server-side; use `ToggleGroup` for Income/Expense; render active and archived states; and make archive/reopen behavior accessible without using color as the kind indicator. |  |  |
| TASK-020 | Create `src/app/(app)/settings/page.tsx`, `src/components/invite-form.tsx`, and associated tests. Render household members; render the copyable invite-link form only when `CurrentHousehold.role === "owner"`; retain the existing local-only `AccentPicker`; do not add shared visual preferences. |  |  |
| TASK-021 | Create `src/app/(app)/transactions/page.tsx`, `src/components/transaction-ledger.tsx`, and associated tests. Render a server-loaded, month-filtered ledger with date, type, account(s), category, note, amount, edit control, and delete confirmation. The selected month must use the exact `YYYY-MM` URL contract from FIN-005. |  |  |
| TASK-022 | Run route/component tests for accounts, categories, settings, invitation, and transactions. Keyboard-test every icon-only control for an accessible name and verify 44px mobile targets in the browser before Phase 5. |  |  |

### Implementation Phase 5 — Replace fixtures with the live dashboard and transaction composer

- **GOAL-005**: Make the dashboard the truthful shared-household view and add a responsive transaction creation/editing flow.
- **Dependencies**: Phases 2–4 complete.
- **Completion criteria**: `src/app/page.tsx` contains no fixture category/transaction arrays or static currency values; the selected month drives live data; all three transaction kinds mutate and immediately refresh the report.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-023 | Create `src/lib/dashboard-data.ts` and tests. Export `getDashboardData(month)` to obtain the current household, query its accounts/categories/transactions under RLS, call `buildMonthlyReport`, and return an explicit setup state when there is no active bank account. Do not accept a household ID from search parameters or props. |  |  |
| TASK-024 | Create `src/components/dashboard-summary.tsx`, `src/components/category-spending.tsx`, and `src/components/recent-transactions.tsx`. Render formatted ILS values with `Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" })`, separate card debt, labelled category bars plus an accessible table/list alternative, and recent links to the transaction ledger. |  |  |
| TASK-025 | Create `src/components/transaction-sheet.tsx` and tests. Make it the only new large client island. Use `ToggleGroup` for Income, Expense, and Transfer; show bank-only account selection for income; show a matching category picker for income/expense; hide category for transfer; show bank source plus card destination for transfer; preserve entered values and field errors; use desktop `Sheet`, a full-height mobile panel, and `AlertDialog` for deletion. |  |  |
| TASK-026 | Rewrite `src/app/page.tsx` from the current fixture implementation at lines 22-39 and 85-170 into an authenticated server route that parses a valid `YYYY-MM` `searchParams.month`, calls `getDashboardData`, renders empty/loading/error states, uses `AppNavigation`, and opens `TransactionSheet` from the existing Add transaction controls. |  |  |
| TASK-027 | Add/replace `src/app/page.test.tsx` and component tests to assert no fixture amount appears, setup guidance is shown when required, transfer has no category picker, transfer does not change monthly outgoings/category totals, and edit/delete refresh live summary values. Run the focused dashboard suite with exit code 0. |  |  |

### Implementation Phase 6 — Verify RLS, migration state, and the complete development workflow

- **GOAL-006**: Prove the MVP works for two real users in development without expanding deployment scope.
- **Dependencies**: Phases 1–5 complete.
- **Completion criteria**: Automated checks pass, development integration tests prove isolation and invite acceptance, security advisors have no new critical issue, and the browser story succeeds end-to-end.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-028 | Add any required new ordered SQL migration under `supabase/migrations/`; apply it only to the development project; regenerate `src/lib/database.types.ts`; run the matching SQL test under `supabase/tests/`; and record the migration filename in the pull request/commit. Do not modify an applied migration. |  |  |
| TASK-029 | Create `tests/integration/rls-isolation.test.ts` and `tests/integration/invite-acceptance.test.ts`. Use two ordinary development test users through publishable-key APIs; assert household-B cannot select or insert household-A rows; assert only a matching email can consume an active invitation once; and clean only a unique per-run test household. |  |  |
| TASK-030 | Modify `.env.example` with names only for `JOINT_INTEGRATION_USER_A_EMAIL`, `JOINT_INTEGRATION_USER_A_PASSWORD`, `JOINT_INTEGRATION_USER_B_EMAIL`, and `JOINT_INTEGRATION_USER_B_PASSWORD`. Modify `README.md` with the development OAuth callback URL, integration-test command, intentional-skip behavior when credentials are absent, and no production/Vercel instructions. |  |  |
| TASK-030A | Modify `README.md` with the Google OAuth test-user prerequisite: add each invited Google account to the development OAuth consent screen's authorized test-user list before it follows a copied invite URL. Keep the existing Supabase publishable-key-only environment contract. |  |  |
| TASK-031 | Run `bun run lint`, `bun run test`, and `bun run build`; require all exit codes to be 0. Run development security advisors after any migration. Fix failures with a failing test first when they represent behavior. |  |  |
| TASK-032 | Execute this browser acceptance story against development Supabase: sign in; create household; create bank and credit-card accounts; create income and expense categories; create one bank income, bank expense, card expense, and bank-to-card transfer; change month; edit and delete a transaction; create/copy an invite; sign in as the matching invitee; confirm both users see the same data; confirm a third user sees none. Record the first failed boundary if any step fails. |  |  |

## 3. Alternatives

- **ALT-001**: Use direct browser Supabase writes. Rejected because it duplicates authorization in the client and violates SEC-001.
- **ALT-002**: Add a service-role invite acceptance RPC. Rejected because invitee-only RLS and the existing consumption trigger already protect the flow without elevated application credentials.
- **ALT-003**: Treat card purchases as immediate bank expenses. Rejected because it double-counts spending and contradicts FIN-003.
- **ALT-004**: Keep dashboard fixtures until the ledger is complete. Rejected because static currency values make the product appear functional when it is not.
- **ALT-005**: Use Supabase Auth admin invitations or an external transactional-email provider. Rejected because the former requires a service-role secret and the latter adds an unnecessary vendor/key for a two-person development MVP; a copied link plus Supabase Google OAuth preserves the existing RLS security boundary.
- **ALT-006**: Deploy to Vercel or create production Supabase as part of completion. Rejected by CON-002; development/staging is the authorized scope.

## 4. Dependencies

- **DEP-001**: Existing Next.js 16.2.10, React 19.2.4, TypeScript, Bun, Vitest, shadcn/Radix, Zod 4, and Supabase SSR packages in `package.json`.
- **DEP-002**: Development Supabase project with existing ordered migrations applied and Google OAuth redirect configured for `http://127.0.0.1:3000/auth/callback`.
- **DEP-003**: Existing owned shadcn source under `src/components/ui/`, especially `alert-dialog.tsx`, `sheet.tsx`, `toggle-group.tsx`, `select.tsx`, `table.tsx`, and `calendar.tsx`.
- **DEP-004**: Environment values kept only in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **DEP-005**: Development Google OAuth consent screen includes every test invitee account, and Supabase Auth has `http://127.0.0.1:3000/auth/callback` in its allowed redirect URLs.

## 5. Files

- **FILE-001**: `src/app/page.tsx` — replace fixture dashboard with authenticated live dashboard.
- **FILE-002**: `src/app/(app)/accounts/page.tsx`, `categories/page.tsx`, `settings/page.tsx`, and `transactions/page.tsx` — authenticated management and ledger routes.
- **FILE-003**: `src/app/invite/[token]/page.tsx` and `src/app/login/page.tsx` — invite-link sign-in handoff.
- **FILE-004**: `src/app/actions/result.ts`, `accounts.ts`, `categories.ts`, `invitations.ts`, and `transactions.ts` — typed mutation boundary.
- **FILE-004A**: No email transport or additional provider package is added; invitation delivery is the owner-facing copy-link UI in `src/components/invite-form.tsx`.
- **FILE-005**: `src/lib/finance-types.ts`, `validation.ts`, `financial-report.ts`, and `dashboard-data.ts` — pure data and report contracts.
- **FILE-006**: `src/components/app-navigation.tsx`, account/category/invite forms, transaction ledger/sheet, and dashboard presentation components — accessible interactive UI.
- **FILE-007**: `src/lib/household.ts`, `src/lib/account-balances.ts`, and their tests — shared authenticated/data-domain support.
- **FILE-008**: `supabase/migrations/<timestamp>_*.sql`, `src/lib/database.types.ts`, and `supabase/tests/*.sql` — only if a verified schema gap requires a new migration.
- **FILE-009**: `tests/integration/*.test.ts`, `.env.example`, and `README.md` — opt-in development verification and setup documentation.

## 6. Testing

- **TEST-001**: Unit-test financial validation, balance calculations, monthly report aggregation, and all transaction-kind rejections.
- **TEST-002**: Unit-test every Server Action for verified identity, household scoping, validation errors, ownership, archive rules, and route revalidation.
- **TEST-003**: Test OAuth `next` validation and invite-route handoff without allowing external redirects.
- **TEST-004**: Render/test account, category, settings, transaction ledger, dashboard, and transaction-sheet states, including transfer field visibility and accessible alternatives.
- **TEST-005**: Run integration RLS isolation and matching/expired/replayed invitation acceptance with ordinary development users.
- **TEST-006**: Run `bun run lint`, `bun run test`, `bun run build`, relevant Supabase SQL tests/advisors, and the Phase 6 browser acceptance story.

## 7. Risks & Assumptions

- **RISK-001**: Aggregating only the selected month's rows would produce false balances. Mitigation: FIN-005 requires balance inputs through selected month end.
- **RISK-002**: Archiving referenced accounts would make transaction history invalid or uneditable. Mitigation: TASK-012 blocks that archive operation.
- **RISK-003**: The database trigger remains the final integrity guard but server validation may drift from it. Mitigation: test the same transaction matrix in `validation.test.ts` and action tests.
- **RISK-004**: Integration credentials are unavailable in some environments. Mitigation: tests intentionally skip with a clear message; the manual development browser story remains required before MVP completion.
- **ASSUMPTION-001**: Existing OAuth callback, household onboarding, and invitation-consumption migrations have been applied to the development project and are retained.
- **ASSUMPTION-002**: The owner manually shares the invitation URL and manually authorizes the second Google account for the development OAuth project; no email delivery is required for this MVP.
- **ASSUMPTION-003**: Initial account opening balances represent the balance/debt as of their opening date; historical reports start from that defined point rather than reconstructing unavailable earlier records.

## 8. Related Specifications / Further Reading

- [Agent guide](../../AGENTS.md)
- [Design system](../design.md)
- [Architecture](../architecture.md)
- [Development MVP implementation record](../superpowers/plans/2026-07-14-development-shared-budget-mvp.md)
- [Initial database schema](../../supabase/migrations/20260713230229_initial_schema.sql)
