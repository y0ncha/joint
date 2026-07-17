# Joint — Agent Guide

## Mission

Joint is a calm shared household-money app for two people. The MVP supports manual entry of shared income, expenses, and bank-to-card transfers. Optimize for the shared household view, not separate personal budgeting.

## Documentation index

Read the sources relevant to the task before proposing or changing behavior:

- `AGENTS.md` — contribution workflow, engineering rules, and product invariants.
- `README.md` — local setup, commands, environment variables, and project-local agent resources.
- `docs/design.md` — product intent, visual system, interaction behavior, accessibility, and responsive layout.
- `docs/architecture.md` — technical system overview and index of durable mechanism documentation.
- `docs/architecture/` — focused records for implemented architecture mechanisms; plans and delivery status do not belong here.
- `docs/plans/` — approved or proposed implementation plans and their delivery status.
  - `docs/plans/shared-budget-mvp.md` — core MVP implementation plan.
  - `docs/plans/two-layer-access.md` — two-layer access implementation plan.
  - `docs/plans/features/` — post-MVP roadmap briefs. These are product directions, not approved implementation plans, and do not expand MVP scope by themselves.
- `docs/superpowers/specs/` — historical design specifications created during earlier work.
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

2. **Write the implementation plan**
   - Use the `$create-implementation-plan` skill.
   - Create a new source plan at `docs/plans/<plan-name>.md`; do not place new plans in `docs/superpowers/plans/`.
   - Make the plan executable: name exact files, ordered tasks, dependencies, validation, risks, and completion criteria.
   - Wait for explicit user approval of the plan before implementing it.

3. **Create a dedicated branch**
   - After plan approval, branch from the latest `main` as `feature/<plan-name>`.
   - The required prefix is `feature/` (not `feautre/`).
   - Do not overwrite, clean, or carry unrelated working-tree changes into the branch. If the checkout is not safe, stop and ask the user how to handle the existing changes.

4. **Implement and verify**
   - Follow the approved plan and keep its status current.
   - Use test-first development for domain logic and behavior changes.
   - Keep changes inside the approved scope. Return to the user for approval before changing the design, architecture, or plan materially.
   - Run `bun run lint`, `bun run test`, and `bun run build`. All checks must pass before requesting implementation approval.
   - Present what changed, why, remaining risks, and how the user can evaluate it. Wait for explicit implementation approval.

5. **Merge and synchronize**
   - After implementation approval, ask for explicit permission to merge into `main` and push. Approval of the implementation alone is not permission to merge or push.
   - Once permission is granted, update local `main` from its remote with a fast-forward-only pull, merge `feature/<plan-name>`, and push `main`.
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
- GitHub pull requests should create Vercel previews. `main` deploys production only after the production project is available.

## Financial invariants

- Amounts are positive ILS values; transaction `kind` determines direction.
- Income posts only to a bank account and uses an income category.
- Expenses post to either a bank account or credit card and use an expense category.
- Transfers are bank-to-credit-card only, have no category, reduce bank balance and card debt, and never appear in category spending or monthly expense totals.
- The dashboard headline is shared bank balance. Card debt is reported separately.
- Categories are household-owned, editable, and archivable.
- Labels, budgets, recurring transactions, bank imports, attachments, and card credentials are outside the MVP unless the user explicitly approves a scope change and its plan.
- Never present static dashboard values as persisted data.

## UI and accessibility

- Use semantic tokens from `src/app/globals.css`; do not introduce arbitrary Tailwind colors.
- Preserve the warm gradient canvas and restrained floating surfaces. Avoid image backgrounds and nested glass-card clutter.
- Prefer owned shadcn components and check their documentation before adding or changing them. Use `ToggleGroup` for 2–7 related options.
- All controls require keyboard access, visible focus, and 44px mobile targets. Charts require labelled, non-color alternatives.
- Personal accent preference is browser-local (`joint-accent`) and must not alter semantic expense or destructive colors.

## Scope discipline

- Roadmap briefs under `docs/plans/features/` do not authorize implementation or change the current MVP contract.
- Do not add deferred features opportunistically while implementing an approved plan.
- Do not claim live authentication, OAuth, RLS, or deployment behavior without verifying it in the relevant environment. Separate implemented code, local test evidence, and unverified provider behavior in status reports.
