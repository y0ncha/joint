# Profile Name Settings Row Implementation Plan

**Goal:** Show the saved profile name as the Account-row label and use `Edit` for the existing editor trigger.

| Task | Description | Status | Date |
| --- | --- | --- | --- |
| TASK-001 | Update the focused Settings render test first, then adjust the existing row label and editor trigger without changing the mutation or popover. | In progress | 2026-07-25 |

## Files

- `docs/design.md` — Settings interaction contract.
- `src/app/(app)/settings/page.tsx` — supplies the saved name as the row label.
- `src/components/profile-name-settings-control.tsx` — uses `Edit` as the existing Popover trigger label.
- `src/app/(app)/settings/page.test.tsx` — proves the saved name is a row label and `Edit` is rendered.

## Verification

1. Run the focused Settings test after adding its assertions; it must fail before source changes.
2. Make the smallest source changes and rerun the focused test.
3. Run lint, the full test suite, and build before requesting implementation approval.
