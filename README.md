# Joint

Joint is a shared household-money workspace for two people. The MVP supports manual income, expenses, and bank-to-card transfers in Israeli shekels.

## Start here

- [Agent guide](AGENTS.md)
- [Design system](docs/design.md)
- [Architecture](docs/architecture.md)
- [MVP delivery plan](docs/plans/shared-budget-mvp.md)

<img src="public/brand/favicon.png" alt="Joint favicon" width="128" />

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

The Google OAuth callback for development is `http://127.0.0.1:3000/auth/callback`. Before sharing a copied household invite link, add the recipient's Google account to the development OAuth consent screen's test-user list.

## Environment

Copy `.env.example` to `.env.local` and provide development Supabase values. Do not commit `.env.local`.

Optional integration-test user credentials are listed in `.env.example`. Those tests intentionally skip when credentials are absent; do not add production credentials or a service-role key.

## Project-local agent resources

The `.agents/` directory is intentionally committed so the repository remains a dedicated, self-contained Codex project. It contains the local shadcn skill; operational instructions are in `AGENTS.md`.
