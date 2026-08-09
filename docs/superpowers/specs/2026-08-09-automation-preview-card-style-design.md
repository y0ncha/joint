# Automation Preview Card Style Design

## Goal

Make existing-transaction preview rows feel like the main automation rule rows without copying the rule-row layout or changing preview behavior.

## Approved design

Reuse one small surface class for both rule rows and preview rows:

- `rounded-xl` shape
- `border-border/70` border with the existing destructive override for delete previews
- `bg-card` surface
- the existing explicit border/shadow transition and hover state
- compact card-like padding

Preview rows remain static stacked content. The merchant change and destination stay in the current text hierarchy, the Apply action remains outside the list, and delete previews retain their warning copy and destructive border.

## Options considered

1. Share only the rule-row surface styling while keeping the preview markup. Recommended and approved because it matches the visual language with the smallest behavior-preserving diff.
2. Render previews through the full sortable rule-row component. Rejected because previews are not reorderable rules and would inherit unrelated controls and interaction semantics.
3. Restyle only the outer Existing transactions card. Rejected because the visible mismatch is inside the card, where preview rows currently use a different surface treatment.

## Scope and verification

Only `src/components/automation-rules-workspace.tsx` and its focused test are in implementation scope. Verify the existing preview rendering assertions plus the new shared surface classes with the focused Vitest test, ESLint, Prettier check, and `git diff --check`. No data, action, copy, or responsive behavior changes are required.
