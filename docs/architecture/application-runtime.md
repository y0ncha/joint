# Application Runtime

## Purpose

This document explains how a request moves through the Joint Next.js application, where trust decisions occur, and how rendering, queries, mutations, and Supabase sessions are separated.

## Runtime boundary

```text
Browser request
  ↓
src/proxy.ts → refresh Supabase session cookies
  ↓
App Router page, layout, or route handler
  ├─ request-scoped household context from verified claims
  ├─ Server Component queries through its Supabase server client
  └─ authenticated Server Actions for persistent mutations
       ↓
Supabase Postgres → RLS evaluates the caller and household boundary
```

Next.js runs the application boundary; Supabase remains the persistence and final row-authorization boundary.

## Routing and rendering

- `src/app/layout.tsx` owns global fonts, metadata, CSS, and shared UI providers.
- `src/app/(app)/layout.tsx` protects every product route, including `/`, by requiring verified identity and household membership.
- `src/app/(app)/page.tsx` renders the dashboard inside that protected route group.
- `src/app/login/` is public and initiates Google OAuth.
- `src/app/auth/callback/route.ts` exchanges the OAuth code, derives verified claims, and admits an existing member or a partner whose email matches `household_allowed_members`.
- `src/app/auth/access-denied/route.ts` clears an unmatched session locally before returning to the login page.
- Product pages default to Server Components. Client components are used only for browser-local state, interactive controls, focus management, and form pending state.

## Supabase clients and sessions

- `src/lib/supabase/server.ts` creates a cookie-backed server client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `src/lib/supabase/browser.ts` creates the browser client with the same publishable configuration.
- `src/lib/supabase/proxy.ts` refreshes sessions and writes updated cookies on matched requests.
- `src/proxy.ts` exposes the Next.js proxy entry point and excludes static assets.
- Server Components may read cookies but cannot always persist refreshed cookies; the proxy owns that refresh path.

The publishable key is intentionally available to the browser. Authorization depends on verified claims and RLS, not secrecy of that key.

## Household request context

`src/lib/household.ts` resolves the cookie-backed Supabase client, verified claim subject, and membership once per React server request with `cache`. The result is exactly one of `unauthenticated`, `unmatched`, or `member`; a member result includes the server client, user ID, household ID, and role. Protected layouts redirect the first two states to `/login` and `/auth/access-denied`; Server Components and Server Actions use the member result rather than accepting identity or household data from browser input.

The resolver derives identity only from `auth.getClaims()` and obtains membership through `getHouseholdForUser`. OAuth partner admission stays separate: the callback continues to use its own verified principal and `ensurePartnerMembership`. `household_members` remains the authorization truth and RLS remains the final row-level check.

## Queries

- Server Components query Supabase through the member request context's server client.
- Household-scoped loaders derive the caller's sole `household_members` row from verified claims; browser input does not select `household_id`.
- `src/lib/dashboard-data.ts` loads the household opening balance, categories, transactions, and members concurrently, maps database rows to domain types, and passes them to the pure reporting layer.
- Browser queries are limited to data allowed by RLS, such as the current profile name used by the workspace avatar.

`household_allowed_members` is only the partner-join seam. It does not authorize household data: matching OAuth claims may insert the caller's own `member` row, after which ordinary membership-scoped RLS applies.

## Mutations

- Persistent changes live in `src/app/actions/` and use the `"use server"` boundary.
- Actions parse `FormData` with Zod schemas from `src/lib/validation.ts`.
- Trusted user, household, and role identifiers come from the member request context.
- Partner-access actions accept only the normalized email, derive the owner and household from membership, and insert or remove the single `household_allowed_members` row. Removing it also removes any joined partner membership in the same database transaction.
- Updates and deletes include the verified household ID in their database filters.
- Successful mutations revalidate affected routes through `revalidatePath` or redirect after setup.
- User-facing action results contain sanitized form and field errors; raw database details are not rendered.

## Client interaction boundary

Client components own only interaction that requires browser state, including:

- Sheets, popovers, dialogs, selects, and calendars.
- Local accent persistence in `joint-accent`.
- Form pending state, error focus, and focus restoration.
- Responsive navigation state derived from the current pathname.

Financial persistence, role decisions, and household selection do not belong in client state.

## Failure behavior

- Missing authentication redirects to `/login`.
- An OAuth identity without an existing or authorized membership is signed out with local scope and redirected to `/login?error=access_denied`.
- A stale authenticated session without membership is routed through `/auth/access-denied`, which performs the same local sign-out.
- Query failures fail the server-rendered request with a sanitized application error.
- Server Actions return structured validation or form errors and do not expose database messages.
- RLS remains authoritative if an application filter or route guard is incorrect.

## Primary sources

- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/auth/access-denied/route.ts`
- `src/proxy.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/household.ts`
- `src/lib/dashboard-data.ts`
- `src/app/actions/`
- `supabase/migrations/20260716104257_replace_invitations_with_allowed_members.sql`
- `supabase/migrations/20260716160941_disable_self_service_household_creation.sql`
- `supabase/migrations/20260717062900_serialize_partner_claim_and_removal.sql`
- `supabase/migrations/20260717065628_serialize_partner_claim_with_authorization_lock.sql`

## Non-goals

- This document does not define visual composition; see `docs/design.md`.
- It does not track access-control migration tasks; see `docs/plans/two-layer-access.md`.
- It does not replace database migrations or generated types as schema truth.
