<img src="public/brand/favicon.png" alt="Joint favicon" width="128" />

# Joint

Joint is a shared household-money workspace for two people. The MVP supports manual income and expenses in Israeli shekels, against one shared balance.

## Start here

- [Agent guide](AGENTS.md)
- [Design system](docs/design.md)
- [Architecture](docs/architecture.md)
- [MVP delivery plan](docs/plans/shared-budget-mvp.md)

## Local development

```bash
bun install
bun run dev
```

Open `http://127.0.0.1:3000`.

## Checks

```bash
bun run lint
bun run test
bun run build
```

## Production releases

Pull requests run lint and tests only. A successful push to `main` is the sole production release path: GitHub Actions reconciles ordered `joint-prod` migrations, then asks Vercel to perform its normal production build and deploy. Vercel Git integration is disabled, so it creates no preview or production deployments itself.

Release credentials belong only in GitHub Actions secrets. A Vercel rollback changes application code only; a database migration requires a forward fix or Supabase recovery.

The Google OAuth callback for development is `http://127.0.0.1:3000/auth/callback`. Before a newly authorized partner signs in, add that Google account to the development OAuth consent screen's test-user list.

Google sign-in establishes identity; only a `household_members` row grants access to household data. Owners authorize one partner email in Settings. An unmatched account is signed out locally and shown an access-denied message—there is no self-service household onboarding or global app-access registry.

Future owners must sign in once, then be provisioned by an operator using the transactional [owner provisioning procedure](docs/architecture/operator-owner-provisioning.md).

## Environment

Copy `.env.example` to `.env.local` and provide development Supabase values. Do not commit `.env.local`.

Optional integration-test user credentials are listed in `.env.example`. Those tests intentionally skip when credentials are absent; do not add production credentials or a service-role key.

## Project-local agent resources

The `.agents/` directory is intentionally committed so the repository remains a dedicated, self-contained Codex project. It contains the local shadcn skill; operational instructions are in `AGENTS.md`.
