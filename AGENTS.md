# Joint — Agent Guide

## Mission

Joint is a calm shared household-money app for two people. The MVP accepts manual income and expenses only, against one shared household balance. Optimize for the shared household view, not separate personal budgeting.

## Documentation index

Read the sources relevant to the task before proposing or changing behavior:

- `AGENTS.md` — contribution workflow, engineering rules, and product invariants.
- `README.md` — local setup, commands, environment variables, and project-local agent resources.
- `docs/CONTRIBUTE.md` — contributor access, Supabase setup, checks, and review workflow.
- `docs/design.md` — product intent, visual system, interaction behavior, accessibility, and responsive layout.
- `docs/architecture.md` — technical system overview and index of durable mechanism documentation.
- `docs/architecture/` — focused records for implemented architecture mechanisms; plans and delivery status do not belong here.
- `docs/plans/` — approved or proposed implementation plans and their delivery status.
  - `docs/plans/shared-budget-mvp.md` — core MVP implementation plan.
  - `docs/plans/two-layer-access.md` — two-layer access implementation plan.
  - `docs/roadmap.md` — directional post-MVP roadmap. It does not authorize implementation or expand the current MVP contract.
- `docs/superpowers/plans/` — historical execution plans. New source implementation plans belong in `docs/plans/`.
- `.agents/skills/shadcn/SKILL.md` — project-local shadcn/ui guidance. Read it before adding or materially changing UI components.

When documents disagree, stop and resolve the conflict with the user. Do not silently choose one contract.

## Contribution flow

Every product, design, architecture, or infrastructure change follows this sequence:

1. **Discover and agree on the design**
   - Inspect the current implementation and relevant documents.
   - Identify every open gap, constraint, dependency, risk, and assumption in scope.
   - Recommend a concrete design, including meaningful alternatives and tradeoffs.
   - Resolve decisions and assumptions with the user. Do not start implementation while product or technical decisions remain open.
   - Update `docs/design.md` or `docs/architecture.md` first when the approved decision changes either contract.

2. **Branch management**
   - The user creates, names, switches, and organizes branches.
   - Never create or switch branches without the user's explicit approval, including for small patches.
   - Do not overwrite, clean, or carry unrelated working-tree changes into a branch. If the current checkout is not safe for the approved work, stop and ask the user how to proceed.

3. **Implement and verify**
   - Use test-first development for domain logic and behavior changes.
   - Keep changes inside the approved scope. Return to the user for approval before changing the design, architecture, or plan materially.
   - Run `bun run lint`, `bun run test`, and `bun run build`. All checks must pass before requesting implementation approval.
   - Present what changed, why, remaining risks, and how the user can evaluate it. Wait for explicit implementation approval.

4. **Merge and synchronize**
   - After implementation approval, ask for explicit permission to merge into `main` and push. Approval of the implementation alone is not permission to merge or push.
   - Once permission is granted, update local `main` from its remote with a fast-forward-only pull, merge the selected feature branch, and push `main`.
   - If `main` changed after verification, resolve the integration and rerun all required checks before pushing.
   - Finish on `main` and update it to the latest remote `main`. Confirm the final branch, commit, and clean/dirty working-tree state.

## Stack and commands

- Next.js App Router, TypeScript, Tailwind CSS v4, Bun, shadcn/ui (Radix), Supabase SSR, Postgres/RLS, and Vercel.
- Use Bun. Do not introduce npm lockfiles or use npm for project commands.
- Local commands: `bun run dev`, `bun run lint`, `bun run test`, and `bun run build`.
- Prefer `rtk` wrappers for noisy output where available. Use normal shell commands for small exact checks where filtering could hide necessary detail.

## Engineering rules

- Use App Router and keep client boundaries small. Browser APIs and interaction belong in explicit client components.
- Keep persistent mutations behind authenticated Server Actions. Never ship a Supabase service-role key to the browser.
- Use generated database types from `src/lib/database.types.ts`; regenerate them after every SQL migration.
- Add schema changes as new ordered files in `supabase/migrations/`. Never edit an applied migration.
- Apply RLS to every household-owned table. Household membership is the authorization boundary.
- Keep development and production Supabase credentials separate. Never commit `.env.local`.
- Pull requests run GitHub Actions lint/tests only; use hosted `joint-dev` for manual validation. Vercel's Git integration remains disabled, and GitHub Actions is the sole production release path: quality checks, ordered `joint-prod` migrations, then one Vercel production deployment. Production releases must serialize without cancellation. Vercel rollback does not roll back schema; database recovery is a forward fix or Supabase recovery. Confirm backup/PITR readiness in a separate production-readiness plan before real use or data entry.

## Financial invariants

- Amounts are positive ILS values; transaction `kind` determines direction.
- Joint has exactly one shared household balance: opening balance plus income minus expenses. The shared balance may be negative.
- Income and expenses use categories.
- Categories are household-owned, editable, and archivable.
- Multiple accounts, credit-card debt, transfers, budgets, recurring transactions, imports, labels, attachments, financial credentials, card numbers, and audit history are outside the MVP unless a separately approved plan changes the contract.
- Never present static dashboard values as persisted data.

## UI and accessibility

- Use semantic tokens from `src/app/globals.css`; do not introduce arbitrary Tailwind colors.
- Preserve the warm gradient canvas and restrained floating surfaces. Avoid image backgrounds and nested glass-card clutter.
- Prefer owned shadcn components and check their documentation before adding or changing them. Use `ToggleGroup` for 2–7 related options.
- All controls require keyboard access, visible focus, and 44px mobile targets. Charts require labelled, non-color alternatives.
- Personal accent preference is browser-local (`joint-accent`) and must not alter semantic expense or destructive colors.

## Scope discipline

- The directional roadmap does not authorize implementation or change the current MVP contract.
- Do not add deferred features opportunistically while implementing an approved plan.
- Do not claim live authentication, OAuth, RLS, or deployment behavior without verifying it in the relevant environment. Separate implemented code, local test evidence, and unverified provider behavior in status reports.
- Work only on the branch selected by the user; do not create worktrees unless explicitly requested.
