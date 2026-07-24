# Contributing to Joint

Joint is maintained as a small, owner-authorized project and released under the [MIT License](../LICENSE). Read [`AGENTS.md`](../AGENTS.md) before making changes; it is the source of truth for contribution rules, product boundaries, security, and verification.

## Access

Request access from the project owner by GitHub direct message. Explicit owner authorization is required before using the development environment or contributing changes.

## Prerequisites

- [Bun](https://bun.sh/)
- A development [Supabase](https://supabase.com/) project (`joint-dev`)
- Google OAuth configured for the development Supabase project

Do not use production credentials for local work. The repository does not include a local Supabase instance.

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` and set the development Supabase URL and publishable key.
3. Configure the development Google OAuth callback as `http://127.0.0.1:3000/auth/callback`.
4. Add development Google accounts to the OAuth consent screen's test-user list.
5. Start the app:

   ```bash
   bun run dev
   ```

Open `http://127.0.0.1:3000`.

Optional integration-test credentials may be set in `.env.local`. Tests skip those cases when the credentials are absent. Never add production credentials, database passwords, or service-role keys to the repository.

## Before opening a change

1. Inspect the relevant implementation and documentation.
2. For a product, design, architecture, or infrastructure change, get the design and implementation plan approved before coding.
3. Work only on the branch selected by the project owner; do not create, switch, merge, or push branches without explicit permission.
4. Keep the change inside the approved scope. Do not add roadmap features opportunistically.

Run all required checks:

```bash
bun run lint
bun run test
bun run build
```

## Supabase and database changes

- Use the hosted `joint-dev` project for development database work; never target production from local commands.
- Verify the active Supabase target immediately before any linked command or migration operation.
- Add schema changes as new ordered files in `supabase/migrations/`; never edit an applied migration.
- Regenerate `src/lib/database.types.ts` after every applied migration.
- Keep Row Level Security enabled for every household-owned table and validate membership isolation.
- Do not commit `.env.local`, service-role keys, database passwords, or provider secrets.

## UI and documentation

Follow [`docs/design.md`](design.md) and the project-local shadcn guidance before changing UI. Preserve keyboard access, visible focus, semantic color tokens, and 44px mobile targets.

When an approved implementation plan is completed, add a concise dated entry to [`CHANGELOG.md`](../CHANGELOG.md) describing the user-visible or operational change.

## Review and release

Describe what changed, why, the checks that passed, and any remaining risks. Wait for implementation approval before merge or push. Production releases are handled through the repository's approved release workflow, not from a contributor's local machine.
