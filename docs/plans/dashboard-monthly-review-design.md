# Dashboard monthly review design

Date: 2026-08-11
Status: Approved

## Goal

Replace the unfinished dashboard review layout with three comparable financial cards, an adjacent spending-change summary, and one full-width six-month trend chart without changing Joint's single shared-balance model.

## Layout

The dashboard review grid renders in this order:

1. Income, Outgoings, and Shared balance as three equal cards.
2. Where your money went beside Largest changes.
3. One full-width six-month trend for income, outgoings, and closing shared balance.

The collapsed Latest activity card is removed. Mobile stacks every card in the same reading order without horizontal overflow.

## Data semantics

- The regular month view shows the selected month's income, outgoings, and closing shared balance. Each card compares its value with the average of the preceding three months.
- A custom range shows the selected range's income, outgoings, and balance at the range end. Income and outgoings use the existing projection's previous-three-equivalent-range comparison. Shared balance compares with balances at the ends of those same three preceding ranges.
- The trend always shows six complete monthly points ending with the selected month, or the month containing a custom range's end date. Its three series are monthly income, monthly outgoings, and closing shared balance.
- Largest changes remains a monthly comparison and uses the month containing the selected range's end date when a custom range is active. Its description states that monthly scope.

## Presentation and accessibility

- Reuse the owned shadcn `Card`, `Chart`, and `Table` primitives and the installed Recharts dependency.
- Use semantic positive, negative, and foreground colors. Line labels, differing stroke patterns, exact-value tooltips, and an equivalent data table keep meaning independent of color.
- The chart has labelled axes, keyboard and screen-reader support through Recharts' accessibility layer, a visible legend, tabular currency values, and reduced-motion-safe rendering.
- Each focused server read retains a route-shaped loading card with the same grid span as its final content.

## Verification

Use focused Vitest coverage for comparison calculations, server rendering, chart semantics, and membership fallbacks. Then run the repository's full format, lint, typecheck, and test commands. Finally, inspect the authenticated dashboard in the in-app Browser at desktop and mobile widths, including a custom range, and check the console for errors.
