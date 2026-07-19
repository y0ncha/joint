---
goal: Display clear, safe Google OAuth callback failure guidance on the existing login page
version: 1.0
date_created: 2026-07-19
last_updated: 2026-07-19
status: In progress
tags: [bug, auth, ux]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan makes OAuth callback failures actionable without adding a failure route or exposing provider error details.

## 1. Requirements & Constraints

- **REQ-001**: `missing_code` and `oauth_callback` must display `We couldn't sign you in with Google. Please try again.` on `/login`.
- **REQ-002**: `access_denied` must continue to display `This Google account does not have access to Joint.`
- **SEC-001**: Do not expose Supabase or Google error details.
- **CON-001**: Reuse `/login`; do not add a page, route, dependency, migration, or configuration.
- **PAT-001**: Preserve the existing server-rendered `searchParams` mapping in `src/app/login/page.tsx`.
- **GUD-001**: Reuse the existing `LoginCard` alert; preserve its semantic `destructive` token, accessible `role="alert"`, and current card layout. Do not add arbitrary colors or a second error surface.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Define and prove the required login-page error mapping.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `src/app/login/page.test.tsx`, add a failing test that renders `LoginPage` with `error: "missing_code"` and expects the exact generic retry message and `role="alert"`. | Yes | 2026-07-19 |
| TASK-002 | In `src/app/login/page.test.tsx`, add a failing test that renders `LoginPage` with `error: "oauth_callback"` and expects the same generic retry message. | Yes | 2026-07-19 |
| TASK-003 | Run `bun run test src/app/login/page.test.tsx`; confirm the new tests fail because neither callback error is mapped. | Yes | 2026-07-19 |

### Implementation Phase 2

- **GOAL-002**: Add the smallest safe mapping and verify the regression boundary.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | In `src/app/login/page.tsx`, map `missing_code` and `oauth_callback` to the approved generic retry message; preserve the existing `access_denied` message and null behavior for all other values. Render through the unchanged `LoginCard` alert. | Yes | 2026-07-19 |
| TASK-005 | Run `bun run test src/app/login/page.test.tsx`; confirm all focused tests pass. | Yes | 2026-07-19 |
| TASK-006 | Run `bun run lint`, `bun run test`, and `bun run build`; report results without merging, pushing, deploying, or changing hosted state. Build verification is blocked: two Next builds became idle at `Creating an optimized production build` while holding `.next/lock`; both exact build PIDs were stopped after inspection. |  |  |

## 3. Alternatives

- **ALT-001**: Dedicated failure page. Rejected because the existing login page already owns sign-in retry and error presentation.
- **ALT-002**: Render raw callback/provider failures. Rejected because they can be confusing and expose implementation details.

## 4. Dependencies

- **DEP-001**: Existing `LoginCard` alert rendering in `src/app/login/login-card.tsx`.
- **DEP-002**: Existing OAuth callback redirects in `src/app/auth/callback/route.ts`.

## 5. Files

- **FILE-001**: `src/app/login/page.tsx` — map known callback error codes to the approved message.
- **FILE-002**: `src/app/login/page.test.tsx` — cover both callback errors and preserve access-denied coverage.
- **FILE-003**: `docs/plans/login-auth-failure-messages.md` — track delivery status.

## 6. Testing

- **TEST-001**: Focused login-page tests fail before the implementation and pass after it.
- **TEST-002**: Project lint, test, and build checks pass.

## 7. Risks & Assumptions

- **RISK-001**: A future callback code could silently have no message. This plan intentionally maps only the two codes emitted by the current route.
- **ASSUMPTION-001**: The client-side failure from `signInWithOAuth` already displays its safe message and is out of scope.

## 8. Related Specifications / Further Reading

- `docs/superpowers/specs/2026-07-19-login-auth-failure-messages-design.md`
- `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`
