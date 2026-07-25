# Partner Access Settings Implementation Plan

**Goal:** Let only the household owner view immutable joined-partner details and remove that partner's access from Settings.

| Task | Description | Status | Date |
| --- | --- | --- | --- |
| TASK-001 | Update the Settings contract and add focused red tests for owner and member visibility. | Complete | 2026-07-25 |
| TASK-002 | Add narrowly scoped owner access to a joined partner's display name and render the owner-only detail subrows. | In progress | 2026-07-25 |
| TASK-003 | Run focused tests, lint, full tests, build, and diff checks before implementation handoff. | Pending | — |

## Scope

- `owner` is the administrator role; `member` is immutable.
- Partner name, color, email, and role are read-only.
- Only removal remains editable and retains the current confirmation flow.
- Members do not see a Partner access row or issue a partner-authorization query.
- Pending authorizations show fixed email and pending status; name and color appear only after the partner joins.

## Files

- `docs/design.md` — approved Settings contract.
- `supabase/migrations/20260725111450_allow_owner_partner_profile_read.sql` — owner-only profile-name read policy for their own household member.
- `src/lib/database.types.ts` — regenerated after the migration.
- `src/app/(app)/settings/page.tsx` — query the joined partner profile and render owner-only nested rows.
- `src/app/(app)/settings/page.test.tsx` — assert owner details, pending state, and complete absence for members.

## Execution

1. Add page tests that fail because joined partner details and member-side absence do not yet exist.
2. Add an ordered migration that permits profile reads only where the requester owns a household containing that profile ID; regenerate types.
3. Extend the existing settings query to retrieve the joined member's profile name, pass immutable state to the page, and render Name, User color, Email, and Role subrows below Partner access. Reuse `PartnerAccessControl` for confirmed removal.
4. Run the focused page tests, then `bun run lint`, `bun run test`, `bun run build`, and `git diff --check`.
