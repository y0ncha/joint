---
goal: Deepen authenticated request context and remove placeholder notifications
version: 1.0
date_created: 2026-07-17
last_updated: 2026-07-17
owner: Joint
status: Planned
tags: [architecture, refactor, auth, request-context, deletion, ui]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan implements architecture-review recommendations P1 and P2 as one minimal change set. It makes `src/lib/household.ts` the single request-scoped source of the Supabase server client, verified principal, and membership for protected rendering and Server Actions. It also removes the non-functional notification/avatar surface and its non-persistent Settings controls. This plan does not implement the shared-balance P0 schema change; it consumes the codebase after that plan completes.

## 1. Requirements & Constraints

- **REQ-001**: Protected layouts, protected Server Components, and authenticated Server Actions MUST obtain the Supabase server client, verified user ID, household ID, and household role from one request-scoped result in `src/lib/household.ts`.
- **REQ-002**: The request-scoped result MUST represent exactly three states: unauthenticated, authenticated without household membership, and authenticated household member.
- **REQ-003**: The protected layout MUST redirect an unauthenticated request to `/login` and an authenticated request without membership to `/auth/access-denied`, preserving current behavior.
- **REQ-004**: A Server Action MUST fail with the existing authentication or access error unless the request-scoped result is a household member. It MUST NOT accept a user ID, household ID, role, or Supabase client from browser input.
- **REQ-005**: `ensurePartnerMembership`, the OAuth callback, the access-denied route, session refresh, RLS policies, partner-claim triggers, and `household_allowed_members` MUST remain unchanged.
- **REQ-006**: `src/lib/household.ts` MUST use React request memoization for the request-context resolver. It MUST NOT use module-global mutable state, process-wide caching, a provider-neutral repository, a factory, or a new dependency.
- **REQ-007**: The notification Settings card, static notification array, notification popover, avatar control, profile browser query, and owned avatar UI module MUST be deleted. No disabled or “coming soon” replacement is permitted.
- **REQ-008**: The desktop navigation rail MUST retain only the brand mark and primary navigation after notification/avatar removal. Mobile navigation remains unchanged.
- **REQ-009**: `docs/design.md` MUST be updated before source implementation because P2 changes the visual and interaction contract. Architecture records MUST be updated only after implementation and verification prove the request-context mechanism.
- **SEC-001**: `household_members` remains the only household-data authorization truth. Supabase RLS remains the final row authorization check for every query and mutation.
- **SEC-002**: The request-context resolver MUST derive identity solely from `supabase.auth.getClaims()` and MUST use the existing cookie-backed `createServerSupabaseClient()`.
- **SEC-003**: Request memoization MUST be scoped to a React server request. A value resolved for one user MUST NOT be reusable by another user or session.
- **CON-001**: Execute P1 only after `docs/plans/shared-balance-architecture.md` is `Completed`; that plan deletes account code which this plan must not refactor.
- **CON-002**: P2 may execute before P1, but both changes MUST use one dedicated branch and one verification pass after this plan is explicitly approved.
- **CON-003**: Do not create or edit Supabase migrations, generated database types, Vercel configuration, provider configuration, or hosted Supabase data.
- **CON-004**: Use Bun commands only. Before implementation, follow `AGENTS.md`: obtain plan approval, create `feature/request-context-notification-cleanup` from current `main`, and stop if the working tree is unsafe.
- **CON-005**: Keep the scope limited to P1 and P2. Do not add account, profile, notification, preferences, email, scheduler, repository, cache-provider, or generic Server Action infrastructure.
- **PAT-001**: Use test-first development for the three request-context states, the protected-layout redirects, Server Action membership enforcement, and the deleted notification surface.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Remove the placeholder notification surface without adding replacement behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `docs/design.md` before source implementation. Delete the `Navigation and workspace` requirement that the desktop rail ends with an avatar popover. Delete the `Settings` requirement that notifications use a separate card. Preserve desktop and mobile primary navigation, the brand mark, appearance settings, account/session controls, partner access, keyboard access, and 44px targets. | | |
| TASK-002 | Rewrite `src/components/workspace-shell.test.tsx` and `src/app/(app)/settings/page.test.tsx` first. Assert the desktop rail has no `Open notifications` control, no notification popover content, and no profile browser query. Assert Settings has exactly Appearance and Account cards and has no notification labels or selects. Confirm both focused tests fail before implementation. | | |
| TASK-003 | In `src/components/workspace-shell.tsx`, delete `UserNotificationAvatar`, the static `notifications` array, `useEffect`/`useState` imports, avatar imports, popover imports, and the browser Supabase client import. Delete the `<UserNotificationAvatar />` placement from the desktop rail. Keep navigation, brand mark, responsive rail/bottom-bar behavior, and all page content unchanged. | | |
| TASK-004 | In `src/app/(app)/settings/page.tsx`, delete the Notifications card, `SettingsSelect`, the `Bell` and `CalendarClock` imports, and all owned select imports used only by `SettingsSelect`. Preserve Appearance and Account cards, including the log-out and partner-access rows. | | |
| TASK-005 | Delete `src/components/ui/avatar.tsx`. Before deletion, run `rg -n "@/components/ui/avatar|AvatarBadge|AvatarFallback" src` and require that `src/components/workspace-shell.tsx` is the only production import. Do not delete `src/lib/supabase/browser.ts`; `src/app/login/login-card.tsx` still uses it for Google OAuth. | | |

### Implementation Phase 2

- **GOAL-002**: Establish P1's post-P0 precondition and failing authorization-preserving request-context tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Verify `docs/plans/shared-balance-architecture.md` has status `Completed`, verify its required checks passed, and verify the following post-P0 deletions exist: `src/app/(app)/accounts/page.tsx`, `src/app/actions/accounts.ts`, `src/app/actions/accounts.test.ts`, `src/components/account-form.tsx`, and `src/components/account-list.tsx`. Stop P1 and set this plan status to `On Hold` if any condition is false; P2 remains complete and does not need rollback. | | |
| TASK-007 | Rewrite `src/lib/household.test.ts` first. Cover the memoized resolver's unauthenticated, unmatched, and member states; assert the member state uses the verified claim subject and `getHouseholdForUser`; assert `requireCurrentHousehold` returns the member state and throws the existing user-facing errors for the other states. Add a focused same-request test proving repeated resolver calls use one server client and one claims lookup. Confirm this test fails before implementation. | | |
| TASK-008 | Rewrite `src/app/(app)/layout.test.tsx` first. Mock the new household request-context export instead of mocking Supabase and `getHouseholdForUser` directly. Assert `/login` for `unauthenticated`, `/auth/access-denied` for `unmatched`, and child rendering for `member`. Confirm the focused test fails before implementation. | | |
| TASK-009 | Rewrite focused tests for every remaining post-P0 authenticated consumer: `src/lib/dashboard-data.test.ts`, `src/app/actions/categories.test.ts`, `src/app/actions/transactions.test.ts`, `src/app/actions/partner-access.test.ts`, `src/app/(app)/categories/page.test.tsx`, and `src/app/(app)/settings/page.test.tsx`. Mock only the member request context; assert each query/mutation uses the context's client and membership-derived identifiers. Add one action failure case for a non-member context. Confirm each focused test fails before implementation. | | |

### Implementation Phase 3

- **GOAL-003**: Deepen the existing household module without changing authorization behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | In `src/lib/household.ts`, import React's `cache` and add one private or exported memoized resolver named `getCurrentHouseholdContext`. It MUST create the server client once, call `auth.getClaims()` once, and return a discriminated result with statuses `unauthenticated`, `unmatched`, or `member`. The member result MUST include the same server client, `userId`, `householdId`, and `role`; it MUST obtain membership only through the existing `getHouseholdForUser(supabase, userId)`. | | |
| TASK-011 | In `src/lib/household.ts`, make `requireCurrentHousehold` consume `getCurrentHouseholdContext` and return the member result including its existing server client. Preserve the current error text for no verified identity and no household access. Delete `getCurrentHousehold` after all production callers move to the resolver or `requireCurrentHousehold`. Keep `getHouseholdForUser` because OAuth partner admission uses it through `ensurePartnerMembership`. | | |
| TASK-012 | Update `src/app/(app)/layout.tsx` to consume `getCurrentHouseholdContext`. Redirect only from its explicit status: `unauthenticated` to `/login`, `unmatched` to `/auth/access-denied`, and render children for `member`. Remove its direct `createServerSupabaseClient`, `auth.getClaims`, and `getHouseholdForUser` calls. | | |
| TASK-013 | Update `src/lib/dashboard-data.ts`, `src/app/(app)/categories/page.tsx`, and `src/app/(app)/settings/page.tsx` to use the member request context and its server client. Remove their direct `createServerSupabaseClient` and `getCurrentHousehold` calls. Preserve their existing query selections, error behavior, current-user labels, owner-only partner lookup, and server-rendered output. | | |
| TASK-014 | Update `src/app/actions/categories.ts`, `src/app/actions/transactions.ts`, and `src/app/actions/partner-access.ts` to use the member request context and its server client. Remove their separate client construction. Preserve Zod validation, verified household/user/role derivation, payer validation, owner checks, sanitised errors, RLS-scoped filters, and route revalidation. | | |
| TASK-015 | Do not modify `src/app/auth/callback/route.ts`, `src/app/auth/access-denied/route.ts`, `src/app/actions/auth.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, Supabase SQL, or generated database types. Verify by diff review that no P1 task changed those files. | | |

### Implementation Phase 4

- **GOAL-004**: Verify the complete change set and document the implemented request mechanism.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Update `docs/architecture/application-runtime.md` only after the focused tests pass. Replace the description of repeated client/claims/membership resolution with the implemented request-context mechanism; state the three result states, request-scoped memoization, verified-claims origin, preserved OAuth separation, and RLS final authorization. Update `docs/architecture.md` only if its runtime summary needs one sentence to remain accurate. | | |
| TASK-017 | Run `rg -n "Open notifications|No unread household updates|Monthly summary|Reminder cadence|SettingsSelect|UserNotificationAvatar|@/components/ui/avatar|AvatarBadge|AvatarFallback" src docs/design.md` and require zero matches. Run `rg -n "getCurrentHousehold\(|createServerSupabaseClient\(" src/app/'(app)' src/app/actions/categories.ts src/app/actions/transactions.ts src/app/actions/partner-access.ts src/lib/dashboard-data.ts` and require zero matches. These commands deliberately exclude OAuth, sign-out, and access-denied routes because TASK-015 preserves them. | | |
| TASK-018 | Run focused Vitest files: `src/lib/household.test.ts`, `src/app/(app)/layout.test.tsx`, `src/lib/dashboard-data.test.ts`, `src/app/actions/categories.test.ts`, `src/app/actions/transactions.test.ts`, `src/app/actions/partner-access.test.ts`, `src/app/(app)/categories/page.test.tsx`, `src/app/(app)/settings/page.test.tsx`, and `src/components/workspace-shell.test.tsx`. Then run `bun run lint`, `bun run test`, `bun run build`, and `git diff --check`. Require exit code 0 for every command. | | |
| TASK-019 | Review the final diff against REQ-001 through REQ-009 and SEC-001 through SEC-003. Present the deleted file list, changed request-context call sites, focused/full verification output, and confirmation that no migration, OAuth, RLS, or hosted-environment change occurred. Wait for explicit implementation approval; do not merge, push, deploy, or change hosted state. | | |

## 3. Alternatives

- **ALT-001**: Add a generic repository, client factory, or provider-neutral request interface. Rejected because Supabase is the only adapter and each would create a hypothetical seam.
- **ALT-002**: Memoize only `getCurrentHousehold`. Rejected because callers would still construct a second client and repeat claims lookup; the client, principal, and membership must have one locality-preserving interface.
- **ALT-003**: Use module-global caching. Rejected because it can cross user/session boundaries and is unsafe for authenticated request data.
- **ALT-004**: Leave the avatar and label the notification controls “coming soon”. Rejected because it retains a shallow interface with no persisted behavior.
- **ALT-005**: Build notification persistence, delivery, scheduling, or preferences. Rejected because no approved notification requirement exists.
- **ALT-006**: Refactor account actions and routes as part of P1. Rejected because P0 deletes them; CON-001 prevents duplicate work.

## 4. Dependencies

- **DEP-001**: `docs/plans/shared-balance-architecture.md` reaches `Completed` before P1 starts.
- **DEP-002**: Explicit user approval of this plan before branch creation or implementation.
- **DEP-003**: React and Next.js versions already installed in `package.json`; React's existing `cache` function is the only memoization mechanism used.
- **DEP-004**: Current project-local shadcn rules remain applicable to preserved UI primitives; P2 adds no new primitive.

## 5. Files

- **FILE-001**: `docs/design.md` — remove the notification/avatar visual contract before source work.
- **FILE-002**: `src/lib/household.ts` — own memoized request resolution, verified claims, membership, and reusable server client.
- **FILE-003**: `src/app/(app)/layout.tsx` — redirect based on explicit request-context state.
- **FILE-004**: `src/lib/dashboard-data.ts`, `src/app/(app)/categories/page.tsx`, `src/app/(app)/settings/page.tsx` — consume the member request context.
- **FILE-005**: `src/app/actions/categories.ts`, `src/app/actions/transactions.ts`, `src/app/actions/partner-access.ts` — consume the member request context for authenticated mutations.
- **FILE-006**: `src/components/workspace-shell.tsx` — delete the empty notification/avatar surface.
- **FILE-007**: `src/components/ui/avatar.tsx` — delete after production-import verification.
- **FILE-008**: `src/lib/household.test.ts`, `src/app/(app)/layout.test.tsx`, `src/lib/dashboard-data.test.ts`, affected page/action tests, `src/components/workspace-shell.test.tsx`, and `src/app/(app)/settings/page.test.tsx` — replace stale mocks and prove deletion/authorization behavior.
- **FILE-009**: `docs/architecture/application-runtime.md` and, only if needed, `docs/architecture.md` — document the verified mechanism after implementation.

## 6. Testing

- **TEST-001**: Unit-test all three request-context states and `requireCurrentHousehold` failure behavior.
- **TEST-002**: Prove same-request resolution constructs one server client and retrieves claims once.
- **TEST-003**: Prove protected-layout redirects remain separate for unauthenticated and unmatched identities.
- **TEST-004**: Prove dashboard, protected pages, and Server Actions derive IDs and client access from the member context rather than browser input or local client construction.
- **TEST-005**: Prove the desktop rail, Settings page, and source cleanup contain no notification/avatar placeholder surface.
- **TEST-006**: Run lint, full tests, production build, and whitespace validation after focused checks pass.

## 7. Risks & Assumptions

- **RISK-001**: Incorrect cache scope could leak membership state across sessions. Mitigation: use React request memoization only; prohibit module-global mutable caches; prove each resolver derives identity from the current cookie-backed server client.
- **RISK-002**: A refactor could collapse `/login` and `/auth/access-denied` into one redirect. Mitigation: represent the three explicit states and test both redirects.
- **RISK-003**: Returning a client from the member context could encourage misuse. Mitigation: expose it only from `src/lib/household.ts`; retain RLS, verified claims, and household-scoped filters in every consumer.
- **RISK-004**: Deleting the avatar can alter rail balance. Mitigation: the approved P2 scope deliberately removes the whole non-functional control; visual verification covers desktop and mobile navigation.
- **RISK-005**: P0 may not be complete when this plan is approved. Mitigation: P2 can proceed, but P1 MUST remain `On Hold` until DEP-001 is satisfied.
- **ASSUMPTION-001**: The app remains Google OAuth only, Supabase SSR continues to use cookie-backed server clients, and no notification behavior is required in the MVP.
- **ASSUMPTION-002**: `src/app/login/login-card.tsx` remains the only production consumer of `src/lib/supabase/browser.ts` after P2.

## 8. Related Specifications / Further Reading

- Architecture review P1 and P2 decisions are incorporated directly in this self-contained plan.
- [Shared-balance architecture plan](shared-balance-architecture.md)
- [Membership-only access plan](two-layer-access.md)
- [Application runtime](../architecture/application-runtime.md)
- [Design system](../design.md)
- [Project contribution guide](../../AGENTS.md)
