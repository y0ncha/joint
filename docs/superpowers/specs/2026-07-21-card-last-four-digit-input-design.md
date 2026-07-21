# Card last-four digit input

## Goal

Replace the single card-mapping input with four visible native digit inputs while preserving the existing `lastFour` server-action contract.

## Interaction

- Render four labelled digit inputs as one grouped `Last four digits` field.
- Accept ASCII digits only. Typing a digit advances focus; Backspace on an empty box moves to and clears the preceding box; Left and Right arrows move between boxes.
- Pasting four digits fills all boxes and focuses the last box. Invalid pasted characters are ignored; submission remains server-validated.
- Keep one visually hidden `lastFour` input populated from the four digits, so `saveCurrentMemberCard` and its database/security boundary do not change.
- Preserve the existing privacy copy, error feedback, live status, 44px target, keyboard access, and Skip action.

## Scope

Change only the client card form and its focused test. No dependency, schema, Server Action, route, or database change.
