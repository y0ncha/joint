# CI/CD Architecture

> **Target architecture.** This document defines the approved CI/CD end state. It is not evidence that the split workflows or GitHub branch rules are already configured.

## Purpose

Joint uses one pre-merge CI gate and one post-merge CD release. CI decides whether a pull request may merge; CD applies production migrations and deploys only the resulting `main` commit. The release path does not repeat lint and test work already required before merge.

## Release flow

```text
Pull request targeting main
  ↓
CI: install → lint → test
  ↓
GitHub branch rule permits merge
  ↓
Push to main created by the merge
  ↓
CD: apply joint-prod migrations → Vercel production deploy
```

## CI boundary

`CI` runs only for pull requests targeting `main`.

- Its required check is `CI / Lint and test`.
- It uses no production environment, database URL, or Vercel credentials.
- A failed check blocks the merge.
- Feature-branch pushes without a pull request do not run CI; local checks remain available until a pull request is opened.

## CD boundary

`CD` runs only for pushes to `main`. Its job is `Migrate and deploy production`.

- It assumes the triggering commit passed required CI before merge; it does not rerun lint or tests.
- It uses GitHub's `Production` environment and the repository secrets `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
- It applies immutable ordered migrations to `joint-prod` with `supabase db push --db-url "$SUPABASE_DB_URL" --yes` before calling `vercel deploy --prod`.
- Production releases use the `production-deploy` concurrency group with cancellation disabled. A release may not interrupt a running migration or deployment.
- Vercel Git integration stays disabled; GitHub Actions is the only production release path.

## Merge protection

GitHub branch protection (or an equivalent ruleset) is part of this architecture:

- require a pull request before merging to `main`;
- require `CI / Lint and test`;
- require the branch to be up to date before merge;
- block direct and force pushes, including administrator bypass unless it is explicitly granted.

Without these rules, a direct untested push to `main` could trigger CD. The rules, rather than a duplicate CD test job, enforce the precondition for production deployment.

## Failure behavior

- CI failure prevents merging.
- Migration failure prevents the Vercel deployment.
- Deployment failure does not undo a migration. Migrations must therefore be forward-compatible; recovery is a forward fix or Supabase recovery, not a Vercel rollback.
- Vercel performs the production build during deployment. A failed build prevents the new deployment from becoming production.

## Invariants

- Only `main` can reach `joint-prod`.
- Migrations always precede application deployment.
- Pull requests never receive production credentials or mutate `joint-prod`.
- CD deploys the commit produced by the merge that triggered it.
- No preview deployment or preview-schema migration is created by this pipeline.

## Primary sources

- `.github/workflows/ci.yml` — target `CI` workflow.
- `.github/workflows/cd.yml` — target `CD` workflow.
- `supabase/migrations/` — ordered production schema history.
- `docs/plans/ci-managed-deployment-pipeline.md` — implementation plan and verification evidence.

## Non-goals

- CI/CD does not create a separate preview database or deploy previews.
- CD does not own the Vercel build artifact or add a separate CI build step.
- This document does not replace the production-readiness work needed for backup/PITR validation.
