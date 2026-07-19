# Login authentication failure messages

## Goal

Give people a clear next step when Google OAuth cannot complete, while keeping authorization denial distinct and not exposing provider internals.

## Behavior

- `/auth/callback?error=missing_code` and `/auth/callback?error=oauth_callback` redirect to the existing `/login` page.
- The login page displays: `We couldn't sign you in with Google. Please try again.` for either callback failure.
- `/auth/callback?error=access_denied` continues to display: `This Google account does not have access to Joint.`
- The client-side Google sign-in-start error behavior remains unchanged.

## Scope

- Update only `src/app/login/page.tsx` and its existing server-rendered test.
- Do not add a route, error page, provider-error detail, dependency, database change, or hosted configuration change.

## Verification

- Add tests proving each callback error produces the generic retry message and that access denial retains its distinct message.
- Run the focused login-page test before the project-required lint, test, and build checks.
