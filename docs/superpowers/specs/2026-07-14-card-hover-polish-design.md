# Card hover polish

## Goal

Make Joint's dashboard cards feel responsive without breaking the calm, translucent visual system.

## Design

- The shared `Card` component remains the single source of the treatment, so all current and future cards behave consistently.
- At rest, cards use the shared soft elevation rather than page-local shadows.
- On hover, a card lifts by 1px and transitions to a slightly deeper, low-contrast shadow over 700ms using an ease-in-out curve.
- The hover accent ring is removed: it suggests clickability on cards that are informational rather than actionable.
- `prefers-reduced-motion` continues to disable both the transform and transition.

## Scope and validation

Only `src/components/ui/card.tsx` changes. Validate with `bun run lint` and by checking that the dashboard cards return smoothly to their resting shadows after pointer exit.
