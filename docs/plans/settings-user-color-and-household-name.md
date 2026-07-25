# Settings User Color and Household Name Implementation Plan

**Goal:** Move self-only user-color selection to Account and expose the owner-editable household name in Household.

| Task | Description | Status | Date |
| --- | --- | --- | --- |
| TASK-001 | Update the documented Settings contract and write focused failing action, component, and page tests. | Complete | 2026-07-25 |
| TASK-002 | Replace the cross-member color RPC with a self-only RPC, add household-name action/control, and move the Settings rows. | Complete | 2026-07-25 |
| TASK-003 | Run focused tests, lint, full tests, build, and diff checks before implementation handoff. | In progress | 2026-07-25 |

## Files

- `supabase/migrations/` — breaking RPC replacement enforcing `auth.uid()` as the sole color target.
- `src/app/actions/profile.ts` — authenticated self-color and owner household-name mutations.
- `src/components/member-color-settings-control.tsx` — one signed-in member's `User color` picker.
- `src/components/household-name-settings-control.tsx` — owner-only household-name editor.
- `src/app/(app)/settings/page.tsx` — data query and row placement.
- Focused action, component, and Settings page tests — behavior and rendering coverage.

## Verification

1. Focused tests fail before source changes and pass after them.
2. The migration removes the target-user parameter; the Server Action cannot select another member.
3. Run `bun run lint`, `bun run test`, `bun run build`, and `git diff --check` before handoff.
