---
goal: Simplify household access to one partner authorization seam plus membership
version: 5.1
date_created: 2026-07-16
last_updated: 2026-07-17
owner: Joint
status: Completed
tags: [auth, supabase, rls, household, simplification]
---

# Simplified household access

## Decision

Joint will not maintain a global app-access registry or a Before User Created Auth Hook.

Google OAuth may create an unmatched `auth.users` row. That identity receives no Joint data access because household membership remains the only authorization boundary.

The access model has two ordinary states, not two synchronized authorization systems:

1. `household_allowed_members` stores the one pending partner email for a household.
2. `household_members` stores joined owners and partners and is the sole household-data boundary.

This reuses the single-layer schema already applied to `joint-dev`. The un-applied `private.app_access` / `household_partner_authorizations` branch is deleted.

## Requirements

- **REQ-001**: Google OAuth is the only sign-in provider. Identity comes from verified Supabase claims.
- **REQ-002**: An unmatched authenticated user has a profile but no household membership and no access to household, account, category, transaction, or membership data.
- **REQ-003**: `household_members` is the only household-data authorization truth. RLS checks membership by `auth.uid()`.
- **REQ-004**: A household has exactly one owner and at most one member.
- **REQ-005**: `household_allowed_members` contains at most one normalized Google email per household and one household per email.
- **REQ-006**: A matching signed-in partner may insert only their own `member` membership. Wrong-email, cross-household, owner-role, and third-member inserts fail.
- **REQ-007**: Partner authorization is remove-then-authorize. Pending and joined states cannot overwrite the email.
- **REQ-008**: Removing partner access deletes the member membership and pending authorization atomically while preserving Auth users, profiles, households, and financial history.
- **REQ-009**: Unmatched users cannot create households. Future owners are provisioned explicitly by an operator after their first Google sign-in; there is no self-service owner onboarding in the MVP.
- **SEC-001**: No service-role key, privileged public mutation RPC, security-definer app-access lookup, or global email registry is added.
- **SEC-002**: All public household-owned tables keep RLS enabled and policies scoped to `authenticated` with membership/owner predicates.
- **SEC-003**: Browser input supplies only the partner email and form fields. User ID, household ID, and role come from verified claims and database state.
- **SEC-004**: Server Actions derive the current household from membership and never accept a household ID or role from the browser.
- **UI-001**: Partner access remains one row in the Account card using the owned Popover and AlertDialog.
- **UI-002**: Owners see exactly: no authorization, pending sign-in, or joined partner. Pending/joined states expose removal only.
- **UI-003**: Preserve the visible email label, `type="email"`, `name="email"`, `autoComplete="email"`, `spellCheck={false}`, live errors, error focus, focus restoration, reduced-motion pending state, and 44px controls.
- **CON-001**: `joint-dev` (`magcvzqnwrwxkhtsfspg`) is the only Supabase target. No local Supabase, Vercel, or production changes.
- **CON-002**: Applied migrations remain immutable. New schema changes use ordered migrations.
- **CON-003**: Generated types and active source contain `household_allowed_members` and no `app_access`, `household_partner_authorizations`, or Auth Hook contract.

## Implementation plan

### Phase 1 — Delete the abandoned branch and close the database gap

| Task | Description | Completed |
|---|---|---|
| TASK-001 | Delete the un-applied two-layer migration, `supabase/tests/two_layer_access.sql`, `src/lib/app-access.ts`, and its test. Preserve the three applied single-layer migrations unchanged. | Yes |
| TASK-002 | Replace the current SQL contract with focused `household_allowed_members` pgTAP coverage: normalized email, owner-only authorize/remove, matching self-join, wrong-email denial, owner-role denial, third-member denial, pending removal, joined removal, replacement, cross-household isolation, and protected-data preservation. | Yes |
| TASK-003 | Create an ordered migration that removes self-service household creation from `authenticated`, keeps operator provisioning possible through direct SQL, and verifies no public/anon/authenticated privileged helper bypass remains. Apply it to `joint-dev` only after the preflight confirms the existing owner household is valid. | Yes |

### Phase 2 — Make membership the deep application module

| Task | Description | Completed |
|---|---|---|
| TASK-004 | Replace `ensureAllowedMembership` with `ensurePartnerMembership(supabase, principal)`. It checks existing membership, reads the matching authorization, inserts only the caller as `member`, and recovers only the expected unique-membership race. | Yes |
| TASK-005 | Make the OAuth callback exchange the code, derive verified claims, attempt partner membership, and route members to `/`. Unmatched users sign out locally and redirect to `/login?error=access_denied`; they never reach onboarding. | Yes |
| TASK-006 | Make the protected layout and `requireCurrentHousehold()` use verified identity plus membership only. Move `/` under the protected route group and add the local sign-out access-denied route. | Yes |
| TASK-007 | Remove self-service household onboarding and the household-creation Server Action from active product routes. Document the operator SQL provisioning procedure for a future owner. | Yes |

### Phase 3 — Keep partner lifecycle simple

| Task | Description | Completed |
|---|---|---|
| TASK-008 | Keep one owner action to authorize a partner by inserting—not upserting—`household_allowed_members`, and one removal action that deletes the member membership or pending authorization through the existing atomic database lifecycle. Require exactly one affected row and return sanitized conflict errors. | Yes |
| TASK-009 | Update PartnerAccessControl and Settings for the empty, pending, and joined states while preserving all UI/accessibility requirements. Do not expose Auth users or profiles. | Yes |

### Phase 4 — Contracts, documentation, and verification

| Task | Description | Completed |
|---|---|---|
| TASK-010 | Regenerate `src/lib/database.types.ts` from `joint-dev`. Confirm it contains `household_allowed_members` and no abandoned two-layer contract. | Yes |
| TASK-011 | Update `docs/architecture.md`, `docs/architecture/application-runtime.md`, `docs/design.md`, `README.md`, and `docs/plans/shared-budget-mvp.md` to describe post-auth denial, membership-only RLS, partner authorization, and operator owner provisioning. | Yes |
| TASK-012 | Run the active-code cleanup gate, focused auth/household/action/Settings tests, full tests, lint, build, pgTAP on `joint-dev`, migration reconciliation, and Supabase security/performance advisors. | Yes |

## Delivery note

Implementation review found two database lifecycle gaps after the self-service migration was applied. Immutable follow-up migrations now serialize partner claim/removal, make authorization deletion the sole revocation path, and lock authorization before household state. Both concurrent winner orderings were verified against `joint-dev` before completion.

## Data flow

```text
Google OAuth
  -> verified Supabase identity
  -> existing household_members row? allow
  -> matching household_allowed_members row? claim member membership
  -> otherwise sign out locally and show access denied

Every household query/mutation
  -> RLS checks household_members.user_id = auth.uid()
```

## Explicit deletions

- `private.app_access` and `private.app_access_origin`
- `public.household_partner_authorizations`
- Before User Created Auth Hook and hook configuration work
- `current_user_has_app_access()` and `src/lib/app-access.ts`
- app-access-aware RLS joins and lifecycle synchronization triggers
- self-service owner onboarding
- unauthorized-account creation smoke test

## Verification

- Unknown Google identity: Auth may exist; no household rows are readable or writable; local session is cleared by the app.
- Authorized partner: matching normalized email creates one member membership and gains only that household's access.
- Revoked partner: membership and authorization are removed; the existing Auth user retains no household access.
- Owner: existing membership retains access; future owners require explicit operator provisioning.
- Direct Data API: unmatched or revoked JWT cannot create a household or access household-owned tables.

## Tradeoff

Supabase may retain harmless unmatched Auth/profile rows. This is accepted to delete the global registry, Auth Hook, privileged lookup function, composite authorization FK, synchronization triggers, and repeated app-access checks.
