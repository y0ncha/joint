# Cached profile-initial avatar

## Decision

The desktop rail retains a plain, non-interactive avatar. It shows initials derived from the signed-in user's `profiles.full_name`; it does not open a popover and has no notification badge or notification behavior.

## Data flow

1. The client derives the authenticated user ID from verified Supabase claims.
2. It reads `joint-profile-name:<userId>` from `localStorage`.
3. On a cache miss, it reads only that user's `profiles.full_name`, stores the trimmed value under that key, and renders the initials.
4. The cache key includes the user ID, so a different signed-in user cannot receive the prior user's initials.

## Initials

- Trim and split `full_name` on whitespace.
- Use the first character of the first and last words, uppercased where applicable.
- A one-word name produces one initial; a missing or blank name produces `?`.

## Scope and safeguards

- Keep the existing owned avatar primitive, but remove `AvatarBadge` usage and all notification/popover UI.
- Do not add a dependency, a server-side profile lookup, or a generic cache layer.
- Future profile editing must update or remove that user's cache key.
- Tests must cover cached rendering, cache-miss lookup, user-key isolation, initials, and absence of notification UI.
