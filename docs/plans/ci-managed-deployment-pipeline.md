---
goal: Deploy production through GitHub Actions after applying ordered Supabase migrations
version: 1.2
date_created: 2026-07-18
last_updated: 2026-07-19
owner: Joint
status: In progress
tags: [infrastructure, ci, deployment, vercel, supabase]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Replace Vercel Git auto-deploys with one GitHub Actions production pipeline: validate the exact `main` commit, apply its ordered migrations to `joint-prod`, then deploy that same commit to Vercel. This plan creates no preview-schema migrations and does not change application code.

## Approved release decisions

- Pull requests run lint and tests only. They do not create Vercel previews; manual validation uses `joint-dev`.
- Vercel's Git integration is disabled completely. GitHub Actions is the sole production release path.
- Production releases serialize without cancellation: quality checks complete, migrations apply to `joint-prod`, then Vercel deploys production. Later releases queue rather than interrupt a migration.
- Work happens on one clean `feature/<plan-name>` branch. This repository does not use worktrees for feature isolation.
- Migrations use the project-specific `SUPABASE_DB_URL`; CI does not receive an account-wide Supabase access token.
- Vercel rollback remains available for deployed application code, but does not roll back database migrations. Database recovery requires a forward fix or Supabase recovery.
- Backup/PITR readiness is deferred to a separate production-readiness plan before real use or data entry. The current app has no user data.

## 1. Requirements & Constraints

- **REQ-001**: Only a successful push to `main` may apply migrations to `joint-prod` and deploy production.
- **REQ-002**: The deployment job MUST run after lint and tests succeed for the same commit.
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
| TASK-004 | Update `.github/workflows/ci.yml`: preserve the existing `quality` job for pushes and pull requests; add a `deploy-production` job gated by `github.event_name == 'push' && github.ref == 'refs/heads/main'` and `needs: quality`. Keep quality cancellation separate from a production-only concurrency group with `cancel-in-progress: false`, so releases queue and cannot race or interrupt migrations. | Yes | 2026-07-19 |
| TASK-005 | In `deploy-production`, install the pinned Bun version and Supabase CLI (`2.110.0-beta.32`), then run `supabase db push --db-url "$SUPABASE_DB_URL" --yes`. The current CLI help confirms `--yes` is the noninteractive flag. Do not run `supabase link` or provide an account-wide Supabase access token. | Yes | 2026-07-19 |
| TASK-006 | After migration success, deploy the checked-out commit with the Vercel CLI using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; use a production deploy command that lets Vercel perform its normal remote build. Capture the deployment URL as a workflow summary, not an application secret. | Yes | 2026-07-19 |
| TASK-007 | Update `README.md` and `docs/architecture.md`: GitHub Actions owns the production release ordering, Vercel builds/runs the deployed application, and schema rollback requires a database recovery procedure rather than Vercel rollback. Live release verification remains Tasks 008–009. | Yes | 2026-07-19 |

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

- **FILE-001**: `.github/workflows/ci.yml` — validation and gated production deployment workflow.
- **FILE-002**: `README.md` — developer-facing release procedure.
- **FILE-003**: `docs/architecture.md` — implemented deployment boundary.

## 6. Testing

- **TEST-001**: Pull-request workflow runs lint/tests only.
- **TEST-002**: Production workflow runs ordered migration reconciliation before creating exactly one Vercel deployment.
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
