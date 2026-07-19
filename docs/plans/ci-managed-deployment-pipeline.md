---
goal: Deploy production through GitHub Actions after applying ordered Supabase migrations
version: 1.3
date_created: 2026-07-18
last_updated: 2026-07-19
owner: Joint
status: In progress
tags: [infrastructure, ci, deployment, vercel, supabase]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Replace Vercel Git auto-deploys with separate GitHub Actions workflows: validate pull requests targeting `main`, then apply ordered migrations to `joint-prod` and deploy the resulting `main` commit. This plan creates no preview-schema migrations and does not change application code.

## Approved release decisions

- Pull requests run lint and tests only. They do not create Vercel previews; manual validation uses `joint-dev`.
- Vercel's Git integration is disabled completely. GitHub Actions is the sole production release path.
- Production releases serialize without cancellation: the required PR check passes before merge, then CD applies migrations to `joint-prod` and deploys production. Later releases queue rather than interrupt a migration.
- Work happens on one clean `feature/<plan-name>` branch. This repository does not use worktrees for feature isolation.
- Migrations use the project-specific `SUPABASE_DB_URL`; CI does not receive an account-wide Supabase access token.
- Vercel rollback remains available for deployed application code, but does not roll back database migrations. Database recovery requires a forward fix or Supabase recovery.
- Backup/PITR readiness is deferred to a separate production-readiness plan before real use or data entry. The current app has no user data.

## 1. Requirements & Constraints

- **REQ-001**: Only a successful push to `main` may apply migrations to `joint-prod` and deploy production.
- **REQ-002**: GitHub branch protection MUST require `CI / Lint and test`, require branches to be up to date, and block direct and force pushes to `main`; CD therefore does not repeat lint or tests.
- **REQ-003**: The job MUST run `supabase db push --db-url "$SUPABASE_DB_URL" --yes` against `joint-prod` (`fjstwhrgbslteklwkwfo`) before Vercel deployment; any failure MUST prevent deployment.
- **REQ-004**: Pull requests MUST continue to run lint and tests, but MUST NOT receive database credentials, apply migrations, or deploy.
- **SEC-001**: Store `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` only as GitHub Actions secrets. Do not add them to repository files, Vercel browser-visible variables, or logs.
- **CON-001**: Keep `joint-dev` as the hosted development database. This plan targets only `joint-prod` and does not create local Supabase instances.
- **CON-002**: Applied migration files remain immutable. The pipeline applies existing ordered files only.
- **CON-003**: Disable Vercel's Git integration completely before enabling the workflow, so Git cannot create previews or production deployments.
- **CON-004**: Production migration is forward-only. Vercel rollback alone does not roll back schema; use a forward fix or Supabase recovery when needed.
- **CON-005**: Confirm backup/PITR readiness in a separate production-readiness plan before real use or data entry.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Prepare the production deployment credentials and remove the competing deploy trigger.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Confirm the `joint-prod` project ref is `fjstwhrgbslteklwkwfo`. Obtain its privileged session-pooler database URL for `SUPABASE_DB_URL`; it replaces the account-wide access-token and separate database-password path. Backup/PITR readiness is deferred by CON-005. | Yes | 2026-07-19 |
| TASK-002 | Add `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository-level GitHub Actions secrets. Verify their names only; never print their values. | Yes | 2026-07-19 |
| TASK-003 | Disable the Vercel project's Git integration completely, preventing both preview and production deployments from Git. Keep the project and its production environment configuration unchanged. | Yes | 2026-07-19 |

### Implementation Phase 2

- **GOAL-002**: Make the repository workflow the sole production release path.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Restrict `.github/workflows/ci.yml` to pull requests targeting `main`. Preserve the `CI / Lint and test` check, Bun cache, and cancelable per-pull-request concurrency; do not reference production secrets. | Yes | 2026-07-19 |
| TASK-005 | Add `.github/workflows/cd.yml` for pushes to `main` only. Give its `Migrate and deploy production` job the non-cancelable `production-deploy` concurrency group and GitHub `Production` environment; do not run lint or tests. | Yes | 2026-07-19 |
| TASK-006 | In CD, install the pinned Bun version and Supabase CLI (`2.110.0-beta.32`), run `supabase db push --db-url "$SUPABASE_DB_URL" --yes`, then deploy the checked-out commit with Vercel using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Capture the deployment URL as a workflow summary. | Yes | 2026-07-19 |
| TASK-007 | Record the split-workflow contract in `docs/architecture/ci-cd.md` and this source plan. Live release verification remains Tasks 008–009. | Yes | 2026-07-19 |

### Implementation Phase 3

- **GOAL-003**: Prove the new path deploys once and refuses unsafe releases.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-008 | Run a pull-request workflow and verify it executes only `quality` with no deployment or Supabase secret access. |  |  |
| TASK-009 | Trigger one controlled `main` release. Verify GitHub Actions shows quality, production migration reconciliation, and one Vercel production deployment in order; verify `supabase migration list --db-url "$SUPABASE_DB_URL"` reports the expected ordered history and the deployment serves the expected commit. |  |  |

## 3. Alternatives

- **ALT-001**: Keep Vercel auto-deploy and run migrations in a separate GitHub workflow. Rejected because deployment can begin before the migration completes.
- **ALT-002**: Apply production migrations for every pull-request preview. Rejected because previews do not have isolated production-like databases and would mutate shared schema state.
- **ALT-003**: Build with `vercel build` and deploy `--prebuilt`. Rejected for now because Vercel's existing remote build is sufficient; add it only if CI-owned build artifacts or caching becomes necessary.

## 4. Dependencies

- **DEP-001**: The privileged `joint-prod` session-pooler database URL, Vercel project access, and GitHub repository-secret administration.
- **DEP-002**: A separate production-readiness plan must confirm Supabase backup/PITR recovery before real use or data entry.
- **DEP-003**: Explicit plan approval before branch creation or implementation.

## 5. Files

- **FILE-001**: `.github/workflows/ci.yml` — pull-request validation workflow.
- **FILE-002**: `.github/workflows/cd.yml` — post-merge production migration and deployment workflow.
- **FILE-003**: `docs/architecture/ci-cd.md` — implemented deployment boundary.

## 6. Testing

- **TEST-001**: Pull-request workflow runs lint/tests only, with no production-secret reference.
- **TEST-002**: Production workflow runs ordered migration reconciliation before creating exactly one Vercel deployment, without repeating lint/tests.
- **TEST-003**: `bun run lint`, `bun run test`, and `bun run build` exit zero before implementation approval.

## 7. Risks & Assumptions

- **RISK-001**: A destructive or incompatible migration can make the previous application build unusable. Mitigation: migration review and forward-fix recovery; do not rely on Vercel rollback for schema recovery. Backup/PITR readiness is required before real data is entered.
- **RISK-002**: Incorrect Vercel Git settings can cause duplicate deployments. Mitigation: verify the Git integration is fully disabled before merging the workflow.
- **RISK-003**: A leaked CI secret grants deployment or database access. Mitigation: GitHub secrets only, masked output, a `joint-prod`-only database URL rather than an account-wide Supabase token, and immediate rotation on exposure.
- **ASSUMPTION-001**: `main` remains the only production branch and `joint-prod` remains the sole production database target.

## 8. Related Specifications / Further Reading

- [Agent guide](../../AGENTS.md)
- [Architecture overview](../architecture.md)
- [GitHub Actions secrets](https://docs.github.com/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
- [Supabase CLI database push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Vercel deployments](https://vercel.com/docs/deployments/overview)
