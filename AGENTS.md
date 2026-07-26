# Joint — Agent Guide

## Mission

Joint is a calm shared household-money app for two people. The MVP accepts manual income and expenses only, against one shared household balance. Optimize for the shared household view, not separate personal budgeting.

## Documentation index

Read the sources relevant to the task before proposing or changing behavior:

- `AGENTS.md` — contribution notes, engineering rules, and product invariants.
- `README.md` — local setup, commands, environment variables, and project-local agent resources.
- `docs/CONTRIBUTE.md` — contributor access, Supabase setup, checks, and review workflow.
- `docs/design.md` — product intent, visual system, interaction behavior, accessibility, and responsive layout.
- `docs/architecture.md` — technical system overview and index of durable mechanism documentation.
- `docs/architecture/` — focused records for implemented architecture mechanisms; plans and delivery status do not belong here.
- `docs/plans/` — approved or proposed implementation plans and their delivery status.
  - `docs/roadmap.md` — directional post-MVP roadmap. It does not authorize implementation or expand the current MVP contract.

When documents disagree, stop and resolve the conflict with the user. Do not silently choose one contract.

## Contribution key notes

- Read only the documents relevant to the change; resolve contract conflicts with the user.
- For UI work, get visual confirmation before adding behavior: use a visual-only component or mockup.
- The user controls branches. Never create, switch, clean, merge, or push without explicit approval.
- Keep changes in scope; update design or architecture docs first when their contract changes.
- Test domain and behavior changes. Run lint/tests when useful; do not run `bun run build` unless asked.
- Report changes, evidence, risks, and how to evaluate them; distinguish local checks from live proof.

## Stack and commands

- Next.js App Router, TypeScript, Tailwind CSS v4, Bun, shadcn/ui (Radix), Supabase SSR, Postgres/RLS, and Vercel.
- Use Bun. Do not introduce npm lockfiles or use npm for project commands.
- Local commands: `bun run dev`, `bun run lint`, and `bun run test`.
- Prefer `rtk` wrappers for noisy output where available. Use normal shell commands for small exact checks where filtering could hide necessary detail.

## Engineering rules

- Use App Router and keep client boundaries small. Browser APIs and interaction belong in explicit client components.
- Keep persistent mutations behind authenticated Server Actions. Never ship a Supabase service-role key to the browser.
- Use generated database types from `src/lib/database.types.ts`; regenerate and compare them after every SQL migration.
- Repository schema changes start with `SUPABASE_TELEMETRY_DISABLED=1 supabase migration new <name>` and a reviewed file in `supabase/migrations/`; that file is the source of truth.
- Before every linked Supabase command, confirm `supabase/.temp/project-ref` is hosted `joint-dev` (`magcvzqnwrwxkhtsfspg`). Only one writer may migrate shared `joint-dev`, and migration history must be rechecked immediately before a push.
- Apply repository migrations to `joint-dev` only with `supabase db push --linked`: first run `supabase migration list --linked`, then `supabase db push --linked --dry-run`, then `supabase db push --linked`, and finally rerun the list. If CLI authentication is unavailable, stop instead of changing the schema another way.
- Never use Supabase MCP `apply_migration`, the hosted Dashboard SQL/Table editors, or persistent MCP `execute_sql` for repository-managed schema. MCP remains available for read-only SQL, migration inspection, advisors, and type generation.
- Once a migration has been applied anywhere, its version, name, and contents are immutable. If histories differ, stop and recover the exact original file from authoritative history or an artifact; never use `migration repair`, `db pull`, linked `db reset`, a generated snapshot, or reconstructed SQL to hide the mismatch.
- After applying a migration, verify migration history and the intended catalog behavior, run relevant advisors, and regenerate and compare database types before claiming hosted proof.
- Never manually apply, repair, link, reset, or pull `joint-prod`. Production schema changes run only through `.github/workflows/cd.yml`, which must migrate before deploying the application.
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
