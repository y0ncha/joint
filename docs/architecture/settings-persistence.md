# Settings Persistence and Database Privileges

## Purpose

This record describes the settings mutation boundary and the database privilege model that protects it. It covers durable authorization behavior, not the Settings page's visual composition; see [`docs/design.md`](../design.md) for that contract.

## Boundary and data flow

```text
Settings form
  → authenticated Server Action
  → save_current_settings(profile_name, household_name, member_color)
  → profiles, households, household_members
```

`saveSettings` compares submitted values with the rendered initial values, validates changed fields, and calls the RPC once. It sends `NULL` for unchanged values. A no-op submission does not issue a database mutation. On success, the action revalidates `/settings` and, when the member color changed, `/transactions`.

The RPC derives the caller from `auth.uid()`, loads that caller's sole `household_members` row, and then updates only:

- `profiles.full_name` for the current user;
- `households.name` for the current household, only when the caller is an `owner`;
- `household_members.color` for the current user in the current household.

The function validates non-empty names and six-digit hex colors before any update. A PostgreSQL function call is statement-atomic: an invalid later value prevents all supplied changes from persisting.

## Authorization and privileges

`save_current_settings` is `SECURITY DEFINER` with an empty `search_path`. It is executable only by `authenticated`; `public` and `anon` execute privileges are revoked. Its user, household, and role inputs come only from the authenticated database context, never from request values.

RLS remains enabled on household-owned tables. A remediation migration restricts the affected public-table policies to `authenticated`, revokes every table privilege from `anon`, and grants authenticated only the CRUD operations required by current policies and application flows. The migration removes unused `hypopg` and `index_advisor` extensions while retaining `pgtap` and the active RLS event trigger.

## Invariants

- A caller cannot change another profile, member color, or household through this RPC.
- A non-owner cannot change a household name.
- Anonymous callers cannot query the remediated household tables or execute the settings RPC.
- The application uses generated `Database` RPC types; nullable inputs express unchanged settings.
- Member and accent colors are UI preset choices, while category colors may still use a custom hex value. This is a UI contract; the database continues to validate the six-digit hex storage format.

## Failure behavior

- Form validation failures return field-level action errors before the RPC.
- Database authorization or validation failures return a sanitized form error and trigger no route revalidation.
- A failed RPC has no partial settings update.

## Primary sources

- `src/app/actions/profile.ts`
- `src/components/settings-save-control.tsx`
- `src/lib/database.types.ts`
- `supabase/migrations/20260725212318_remediate_recovery_privileges.sql`
- `supabase/migrations/20260725212335_save_current_settings_atomically.sql`
- `supabase/tests/shared_balance.sql`
- `src/app/actions/profile.test.ts`

## Non-goals

- This mechanism does not persist the browser-local accent.
- It does not change partner access, card mappings, category colors, or financial records.
- It does not replace RLS policies for ordinary table access.
