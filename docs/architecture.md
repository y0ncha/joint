# Joint — Architecture

This document is the technical overview of Joint and the index for detailed mechanism documentation. It describes stable system boundaries and delegates implementation-level explanations to focused records under `docs/architecture/`.

Implementation sequencing and delivery status belong in `docs/plans/`, not here.

## System at a glance

Joint is a Next.js App Router application deployed on Vercel. Supabase provides Google authentication, Postgres, Row Level Security (RLS), and the server-side data API.

```text
Browser
  ├─ Server-rendered application UI
  └─ Small client components for local state and interaction
       ↓
Next.js on Vercel
  ├─ Route handlers for OAuth callbacks
  ├─ Authenticated Server Actions for mutations
  └─ Server Components for household queries
       ↓
Supabase
  ├─ Google OAuth identity and session cookies
  ├─ Postgres household and financial records
  └─ RLS as the final household-data boundary
```

The browser receives only the Supabase publishable key. No service-role key or financial-provider credential belongs in browser code.

## System boundaries

| Boundary | Responsibility |
| --- | --- |
| Browser | Render the workspace, hold non-financial local preferences, and submit user intent. |
| Next.js | Verify claims, enforce route behavior, derive trusted identifiers, execute mutations, and assemble server-rendered data. |
| Supabase Auth | Establish Google identity and maintain the authenticated session. |
| Postgres and RLS | Store household data and reject access outside verified household membership. |
| GitHub Actions | Validate pull requests and order production migration reconciliation before deployment. |
| Vercel | Build and run the Next.js application using environment-scoped configuration; Git integration is disabled. |

## Core domains

### Identity and household access

Google OAuth establishes identity, but identity alone grants no household access. `household_members` is the sole household-data authorization boundary used by RLS. `household_allowed_members` holds at most one pending or joined partner email per household; a matching partner may claim only their own `member` row. Unmatched identities are signed out locally after authentication, and future owners require explicit operator provisioning. There is no global app-access registry, Auth Hook, or self-service owner onboarding.

See [`docs/architecture/operator-owner-provisioning.md`](architecture/operator-owner-provisioning.md) for the operator-only owner setup procedure.

### Shared-money model

A household has one signed opening balance, categories, and transactions. The MVP supports manual income and expenses; the shared balance is opening balance plus income minus expenses.

See [`docs/architecture/financial-model.md`](architecture/financial-model.md).

### Application runtime

Server Components are the default rendering boundary. Client components are limited to browser state and interaction. Persistent mutations use authenticated Server Actions, and Supabase SSR manages cookie-backed sessions.

See [`docs/architecture/application-runtime.md`](architecture/application-runtime.md).

### Visual system

The complete visual and interaction contract remains in [`docs/design.md`](design.md). Architecture records may explain component boundaries, but they must not redefine visual language.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/app/` | App Router pages, layouts, route handlers, Server Actions, and global CSS. |
| `src/components/` | Product components and owned shadcn/ui primitives. |
| `src/lib/` | Domain logic, validation, Supabase clients, generated database types, and utilities. |
| `src/proxy.ts` | Supabase SSR session refresh entry point. |
| `supabase/migrations/` | Immutable, ordered schema, function, trigger, grant, and RLS history. |
| `supabase/tests/` | Database-level behavior and security verification. |
| `docs/architecture/` | Durable explanations of implemented technical mechanisms. |
| `docs/plans/` | Proposed and active implementation plans, tasks, and completion evidence. |
| `docs/plans/features/` | Deferred roadmap briefs that do not authorize implementation. |

## Environments

- Local development reads a development Supabase URL and publishable key from `.env.local`; the current linked development project is `joint-dev`.
- Preview and production values are managed independently in Vercel environment settings and must be verified before deployment.
- `.env.example` contains names only. Never commit `.env.local`, service-role keys, database passwords, or provider secrets.
- Schema work is applied through ordered migrations. Generated types in `src/lib/database.types.ts` must be regenerated after every applied migration.
- Production releases run only from a successful `main` push: GitHub Actions runs `supabase db push` with its repository secret before one Vercel production deployment. Vercel rollback does not reverse a migration; database recovery is a forward fix or Supabase recovery.

## Architecture document index

| Document | Scope |
| --- | --- |
| [`application-runtime.md`](architecture/application-runtime.md) | Request lifecycle, rendering boundaries, session refresh, queries, and mutations. |
| [`ci-cd.md`](architecture/ci-cd.md) | Target pull-request CI gate and post-merge production migration/deployment boundary. |
| [`financial-model.md`](architecture/financial-model.md) | Household-owned finance data, accounting invariants, balances, and monthly reporting. |
| [`operator-owner-provisioning.md`](architecture/operator-owner-provisioning.md) | Operator-only creation of a future owner's household, owner membership, and opening balance. |

## Adding architecture documentation

Add `docs/architecture/<mechanism-name>.md` when a feature or mechanism introduces a durable technical contract that cannot be explained clearly in this overview.

Each mechanism document must:

- Describe implemented and verified behavior, not an aspirational design.
- State its boundary, trusted inputs, data flow, persistence, failure behavior, and security controls.
- Link to the primary source files, migrations, and tests.
- Identify invariants and explicit non-goals.
- Avoid task lists, delivery status, and temporary rollout notes; those belong in `docs/plans/`.
- Update this index in the same change.
