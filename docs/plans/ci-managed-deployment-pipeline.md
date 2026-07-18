---
goal: Deploy production through GitHub Actions after applying ordered Supabase migrations
version: 1.0
date_created: 2026-07-18
last_updated: 2026-07-18
owner: Joint
status: Planned
tags: [infrastructure, ci, deployment, vercel, supabase]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Replace Vercel Git auto-deploys with one GitHub Actions production pipeline: validate the exact `main` commit, apply its ordered migrations to `joint-prod`, then deploy that same commit to Vercel. This plan creates no preview-schema migrations and does not change application code.

## 1. Requirements & Constraints

- **REQ-001**: Only a successful push to `main` may apply migrations to `joint-prod` and deploy production.
- **REQ-002**: The deployment job MUST run after lint and tests succeed for the same commit.
- **REQ-003**: The job MUST link its disposable runner to `joint-prod` (`fjstwhrgbslteklwkwfo`) and run `supabase db push --linked` before Vercel deployment; any failure MUST prevent deployment.
- **REQ-004**: Pull requests MUST continue to run lint and tests, but MUST NOT receive database credentials, apply migrations, or deploy.
- **SEC-001**: Store `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` only as GitHub Actions secrets. Do not add them to repository files, Vercel browser-visible variables, or logs.
- **CON-001**: Keep `joint-dev` as the hosted development database. This plan targets only `joint-prod` and does not create local Supabase instances.
- **CON-002**: Applied migration files remain immutable. The pipeline applies existing ordered files only.
- **CON-003**: Disable Vercel's Git-triggered deployments before enabling the workflow, so one `main` commit cannot create two production deployments.
- **CON-004**: Production migration is forward-only. Recover database data through confirmed Supabase backups/PITR; Vercel rollback alone does not roll back schema.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Prepare the two production credentials and remove the competing deploy trigger.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Confirm the `joint-prod` project ref is `fjstwhrgbslteklwkwfo` and confirm a current backup/PITR recovery path. Create a dedicated Supabase access token and obtain the production database password required by the CLI. |  |  |
| TASK-002 | Add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as repository-level GitHub Actions secrets. Verify their names only; never print their values. |  |  |
| TASK-003 | Disable the Vercel project's Git auto-deploy integration (including automatic production deployments from `main`). Keep the project and its production environment configuration unchanged. |  |  |

### Implementation Phase 2

- **GOAL-002**: Make the repository workflow the sole production release path.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Update `.github/workflows/ci.yml`: preserve the existing `quality` job for pushes and pull requests; add a `deploy-production` job gated by `github.event_name == 'push' && github.ref == 'refs/heads/main'` and `needs: quality`. Give it production-only concurrency so overlapping releases cannot race migrations. |  |  |
| TASK-005 | In `deploy-production`, install the pinned Bun version and Supabase CLI, run `supabase link --project-ref fjstwhrgbslteklwkwfo --password "$SUPABASE_DB_PASSWORD"` on the disposable runner, then run `supabase db push --linked --password "$SUPABASE_DB_PASSWORD"` with `SUPABASE_ACCESS_TOKEN` in the job environment. Do not add `--yes` until the current CLI help confirms the exact noninteractive flag required by the installed version. |  |  |
| TASK-006 | After migration success, deploy the checked-out commit with the Vercel CLI using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; use a production deploy command that lets Vercel perform its normal remote build. Capture the deployment URL as a workflow summary, not an application secret. |  |  |
| TASK-007 | Update `README.md` and `docs/architecture.md` after the workflow is verified: GitHub Actions owns the production release ordering, Vercel builds/runs the deployed application, and schema rollback requires a database recovery procedure rather than Vercel rollback. |  |  |

### Implementation Phase 3

- **GOAL-003**: Prove the new path deploys once and refuses unsafe releases.

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-008 | Run a pull-request workflow and verify it executes only `quality` with no deployment or Supabase secret access. |  |  |
| TASK-009 | Trigger one controlled `main` release containing a harmless new migration. Verify GitHub Actions shows quality, migration, and one Vercel production deployment in order; verify `supabase migration list --linked` includes the migration and the deployment serves the expected commit. |  |  |
| TASK-010 | Verify a deliberately failing migration in a disposable branch or approved non-production target prevents its deploy step. Do not test a failed migration against `joint-prod`. Record the recovery runbook: stop workflow, restore/repair database if needed, then deploy a forward fix. |  |  |

## 3. Alternatives

- **ALT-001**: Keep Vercel auto-deploy and run migrations in a separate GitHub workflow. Rejected because deployment can begin before the migration completes.
- **ALT-002**: Apply production migrations for every pull-request preview. Rejected because previews do not have isolated production-like databases and would mutate shared schema state.
- **ALT-003**: Build with `vercel build` and deploy `--prebuilt`. Rejected for now because Vercel's existing remote build is sufficient; add it only if CI-owned build artifacts or caching becomes necessary.

## 4. Dependencies

- **DEP-001**: Administrative access to the existing `joint-prod` Supabase project, Vercel project, and GitHub repository secrets.
- **DEP-002**: A tested Supabase backup/PITR recovery capability for production.
- **DEP-003**: Explicit plan approval before branch creation or implementation.

## 5. Files

- **FILE-001**: `.github/workflows/ci.yml` — validation and gated production deployment workflow.
- **FILE-002**: `README.md` — developer-facing release procedure.
- **FILE-003**: `docs/architecture.md` — implemented deployment boundary.

## 6. Testing

- **TEST-001**: Pull-request workflow runs lint/tests only.
- **TEST-002**: Production workflow applies an ordered migration before creating exactly one Vercel deployment.
- **TEST-003**: A failed migration blocks the Vercel deploy command in a non-production test target.
- **TEST-004**: `bun run lint`, `bun run test`, and `bun run build` exit zero before implementation approval.

## 7. Risks & Assumptions

- **RISK-001**: A destructive or incompatible migration can make the previous application build unusable. Mitigation: migration review, verified backup/PITR, and forward-fix recovery; do not rely on Vercel rollback for schema recovery.
- **RISK-002**: Incorrect Vercel Git settings can cause duplicate deployments. Mitigation: verify auto-deploy is disabled before merging the workflow.
- **RISK-003**: A leaked CI secret grants deployment or database access. Mitigation: GitHub secrets only, masked output, least privilege, and immediate rotation on exposure.
- **ASSUMPTION-001**: `main` remains the only production branch and `joint-prod` remains the sole production database target.

## 8. Related Specifications / Further Reading

- [Agent guide](../../AGENTS.md)
- [Architecture overview](../architecture.md)
- [GitHub Actions secrets](https://docs.github.com/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
- [Supabase CLI database push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Vercel deployments](https://vercel.com/docs/deployments/overview)
