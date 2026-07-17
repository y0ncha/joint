---
goal: Complete the development shared-household budget MVP
version: 3.0
date_created: 2026-07-14
last_updated: 2026-07-16
owner: Joint
status: 'In progress'
tags: [feature, mvp, finance, supabase, rls]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Complete the development MVP with Google-authenticated household access, one shared balance, categories, manual income and expenses, reporting, and Settings. Development Supabase is the only deployment target.

## 1. Requirements & Constraints

- **REQ-001**: An operator provisions the owner's household after the owner's first Google sign-in. `household_allowed_members` stores at most one normalized pending or joined partner email per household; a household has at most two active members.
- **REQ-002**: Owners manage partner authorization in Settings. Removing authorization also removes any joined partner membership; adding a replacement requires saving its email afterwards.
- **REQ-003**: Members create, edit, archive, and view household income and expense categories.
- **REQ-004**: Members record, edit, delete, and browse manual income and expenses.
- **SEC-001**: Every mutation is an authenticated Server Action using verified claims and membership-derived IDs. Browser input never selects household, user, or role.
- **SEC-002**: RLS protects every household-owned table, with `household_members` as the sole household-data authorization boundary. No service-role key or privileged public RPC is used.
- **FIN-001**: Amounts are positive ILS values with at most two decimal places. Income and expense use the internal shared-balance account; transfers and visible credit-card debt are excluded.
- **UI-001**: Use owned shadcn components, semantic tokens, keyboard support, visible focus, and 44px mobile targets. Partner access stays in the Account card.
- **CON-001**: Add schema changes only through ordered migrations and regenerate `src/lib/database.types.ts` after each applied migration.

## 2. Implementation Steps

### Implementation Phase 1 — Identity and household access

- **GOAL-001**: Keep verified Google OAuth and replace all legacy token authorization with a per-household allowed email.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-001 | Add `household_allowed_members` RLS policies, two-member enforcement, and member-removal authorization cleanup in a new migration. Delete all obsolete token and global allowlist schema objects. |  |  |
| TASK-002 | Exchange OAuth code server-side, automatically create a matching member membership, and locally sign out unmatched accounts with access denied. |  |  |
| TASK-003 | Build owner-only Partner access Settings controls with an accessible email form, Popover, and removal confirmation. |  |  |
| TASK-004 | Verify matching join, mismatch denial, replacement flow, two-member limit, and cross-household isolation against development Supabase. |  |  |

### Implementation Phase 2 — Finance contracts and mutations

- **GOAL-002**: Preserve accounting invariants before persistence and UI work.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-005 | Keep typed account, category, transaction validation, monthly reporting, and balance calculation tests current with the visible one-balance MVP. |  |  |
| TASK-006 | Keep authenticated account, category, and transaction actions scoped by verified membership and revalidate the affected routes. |  |  |

### Implementation Phase 3 — Product surfaces and verification

- **GOAL-003**: Render live RLS-scoped data with accessible Settings, categories, transactions, and dashboard states.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-007 | Keep responsive UI surfaces inside the existing design contract and provide empty, loading, validation, and server-error states. |  |  |
| TASK-008 | Run lint, focused unit tests, full tests, production build, development RLS checks, and Supabase advisors before completion. |  |  |

## 3. Alternatives

- **ALT-001**: Use a global email gate before OAuth. Rejected because household authorization is the relevant access boundary.
- **ALT-002**: Add a service-role or privileged RPC. Rejected because authenticated Server Actions plus RLS cover the required mutations.

## 4. Dependencies

- **DEP-001**: Development Google OAuth consent includes each account that must sign in.
- **DEP-002**: Development Supabase migration access is available for applying and generating types.

## 5. Files

- **FILE-001**: `supabase/migrations/` and `src/lib/database.types.ts` — schema and generated database contract.
- **FILE-002**: `src/lib/household.ts`, the auth callback, partner-access actions, and partner-access components — identity and authorization.
- **FILE-003**: `src/app/`, `src/components/`, and `src/lib/` — MVP finance behavior and accessible presentation.

## 6. Testing

- **TEST-001**: Unit tests cover verified claim handling, partner authorization, owner-only management, removal, and race recovery.
- **TEST-002**: Integration tests cover household isolation, email mismatch, membership capacity, and replacement joining.
- **TEST-003**: Lint, full tests, build, and development Supabase advisors pass.

## 7. Risks & Assumptions

- **RISK-001**: Removing a member revokes future access but preserves financial history linked to their profile.
- **ASSUMPTION-001**: An unmatched Google account has no household access and cannot create a household; future owners require explicit operator provisioning.
- **ASSUMPTION-002**: Development Supabase is the only target for this plan.

## 8. Related Specifications / Further Reading

- `docs/architecture.md`
- `docs/architecture/operator-owner-provisioning.md`
- `docs/design.md`
- `README.md`
