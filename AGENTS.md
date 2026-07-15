# Joint — Agent Guide

## Mission

Joint is a calm, shared household-money app for two people. Its MVP is manual entry of shared income, expenses, and bank-to-card transfers. The primary value is the shared household view, not separate personal budgeting.

Read these documents before changing product behavior:

1. `docs/design.md` — visual and interaction contract.
2. `docs/architecture.md` — current system, security model, and accounting rules.
3. `docs/plans/shared-budget-mvp.md` — delivery status and next implementation steps.

## Stack and commands

- Next.js App Router, TypeScript, Tailwind CSS v4, Bun, shadcn/ui (Radix), Supabase SSR, Postgres/RLS, Vercel.
- Use Bun. Do not introduce npm lockfiles or use npm for project commands.
- Local commands: `bun run dev`, `bun run lint`, `bun run test`, `bun run build`.
- Use `rtk` wrappers for noisy output where available.
- After code changes, run lint and relevant tests. Run a production build for changes that touch routing, types, Supabase, or build configuration.

## Implementation rules

- Use App Router and keep client boundaries small. Browser APIs and interaction belong in explicit client components.
- Keep all persistent mutations behind authenticated Server Actions. Never ship a Supabase service-role key to the browser.
- Use the generated database types in `src/lib/database.types.ts`; regenerate them after every SQL migration.
- Create schema changes only as new ordered files in `supabase/migrations/`. Do not edit an applied migration.
- Apply RLS to every household-owned table. Membership is the authorization boundary.
- Follow test-first development for domain logic and behavior changes.

## Financial invariants

- Amounts are positive ILS values. Transaction `kind` determines direction.
- Income posts only to a bank account and uses an income category.
- Expenses post to either bank or credit card and use an expense category.
- Transfers are bank → credit-card only, have no category, reduce bank balance and card debt, and never appear in category spending or monthly expense totals.
- Dashboard headline = shared bank balance. Card debt is reported separately.
- Categories are household-owned, editable, and archivable. Do not add labels, budgets, recurring transactions, bank imports, attachments, or card credentials to the MVP.

## UI and accessibility

- Treat a design change as small when it is a localized implementation detail that does not alter a user flow, visual system, component contract, or product boundary; implement it directly without updating design documentation or waiting for approval.
- For a larger design change, first propose and document the intended contract in `docs/design.md`, then wait for explicit approval before implementation. Do not start implementation while that approval is pending.
- Use the semantic tokens in `src/app/globals.css`; do not introduce arbitrary Tailwind colors.
- Keep the warm gradient canvas and restrained floating surfaces. No image backgrounds or nested glass-card clutter.
- Use the owned shadcn components first. The full project skill is at `.agents/skills/shadcn/SKILL.md`.
- Check a component's shadcn docs before adding or changing it. Use `ToggleGroup` for 2–7 related options.
- All controls need keyboard access, visible focus, and 44px mobile targets. Charts need labelled non-color alternatives.
- Personal accent preference is browser-local (`joint-accent`); it must not alter the semantic expense/destructive color.

## Security and deployment

- Google OAuth uses Supabase Auth. Invite links add a user to a household after sign-in.
- Keep development and production Supabase credentials separate. Use Vercel environment settings; never commit `.env.local`.
- Development Supabase project is already configured. Production setup is pending an available Supabase project/plan.
- GitHub pull requests should create Vercel previews; `main` deploys production once the production project is available.

## Current delivery truth

- Implemented: responsive dashboard foundation, personal palette picker, Supabase schema/migrations/RLS, Supabase SSR client scaffolding, Google-login entry UI, and pure balance-calculation tests.
- Not implemented: auth callback, household creation/invite acceptance flows, Server Actions, persistent transaction entry, account/category management, and end-to-end RLS/auth tests.
- Do not present the current static dashboard values as real persisted data.
