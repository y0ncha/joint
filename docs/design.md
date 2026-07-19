# Joint — Design System

This document is the single visual and interaction contract for Joint. It owns the product's design language, color palettes, typography, iconography, layout, component patterns, motion, accessibility, and visible MVP boundaries.

## Product intent

Joint is a calm shared household-money workspace for two people. It should make the shared balance, current-month income and spending, and category activity immediately understandable without looking or behaving like a bank portal.

The interface should feel quiet, trustworthy, and operational. Prefer clear hierarchy and comfortable density over decorative composition.

## Design language

- Float a small number of warm, translucent surfaces over a peach-to-blue canvas.
- Use soft borders, restrained blur, rounded geometry, and low-contrast shadows.
- Keep the application light-first for the MVP; do not add a dark-mode toggle.
- Avoid image backgrounds, nested glass cards, large marketing treatments, and ornamental data visualizations.
- Reuse an established surface, row, form, or navigation family before introducing a new pattern.
- Use semantic styling for meaning. A personal accent may change emphasis, but never financial semantics.

## Color system

The implementation source of truth is `src/app/globals.css`. Use semantic CSS tokens through Tailwind; do not add arbitrary colors inside components.

### Foundation palette

| Role | Value | Usage |
| --- | --- | --- |
| Canvas start | `#f6d4b8` | Warm top-left of the fixed application gradient. |
| Canvas middle | `#b5cad0` | Cool transition through the canvas. |
| Canvas end | `#0d4f73` | Deep-blue lower edge of the canvas. |
| `background` | `#f6d4b8` | Fallback page background. |
| `foreground` | `#17201d` | Primary text and high-emphasis icons. |
| `card` | `rgba(255, 252, 247, 0.92)` | Main floating surfaces. |
| `popover` | `#fffaf5` | Opaque menus, calendars, selects, and popovers. |
| `muted-foreground` | `#58635e` | Supporting text and quiet icons. |
| `border` | `rgba(23, 32, 29, 0.12)` | Low-contrast boundaries and dividers. |
| `positive` | `#0f6b54` | Positive financial values. |
| `negative` | `#9e3e35` | Negative financial values. |
| `destructive` | `#9e3e35` | Irreversible actions and destructive context. |

Color must reinforce meaning rather than carry it alone. Text, values, labels, or icons must communicate the same meaning without color.

### Personal accent palettes

Each browser may select one curated accent. The preference is stored locally as `joint-accent`; it is not shared household data.

| Palette | Primary | Soft accent | Character |
| --- | --- | --- | --- |
| Mint | `#0f6b54` | `#dcece3` | Default, calm green. |
| Sky | `#236a8d` | `#dcecf2` | Cool blue. |
| Lilac | `#7056a3` | `#ece5f4` | Muted violet. |
| Clay | `#aa583e` | `#f6e3dc` | Warm terracotta. |
| Blush | `#a14b78` | `#f5e2eb` | Soft rose. |

The selected accent may change primary actions, neutral emphasis, chart steps, focus rings, and active navigation. It must not change positive, negative, expense, or destructive meaning. Palette controls name every option in text; a color dot is insufficient.

### Contrast

- Text and controls must meet WCAG AA contrast.
- Popovers must be opaque enough that underlying page text cannot interfere.
- Focus rings must remain visible on the canvas and every surface.
- Disabled controls must remain legible while clearly unavailable.

## Typography and numbers

- Use Geist Sans for interface text, labels, headings, and navigation.
- Use Geist Mono for money, dates, transaction metadata, and other values that benefit from stable character widths.
- Use sentence case. Avoid all-caps labels and marketing-style title case.
- Page titles use a compact, semibold hierarchy; supporting copy remains short and muted.
- Format currency as Israeli shekels (`ILS`, displayed with `₪`).
- Display dates as `DD/MM/YYYY`; internal form and persistence values remain ISO `YYYY-MM-DD`.
- Right-align comparable numeric columns in tables. Never rely on sign or color alone to identify transaction direction.

## Layout and responsive behavior

- Desktop uses a narrow icon-only left rail and a twelve-column content grid.
- Mobile uses a compact top region and fixed bottom navigation with safe-area spacing.
- `WorkspaceShell` owns one full-width content wrapper for every authenticated route.
- Page logo, eyebrow, title, description, and actions share one top rhythm.
- Use `gap-6`, `p-6`, and `text-sm` as the normal density baseline, adjusting down only where the existing component family requires it.
- Keep primary actions reachable with one hand on mobile.
- Route content must not introduce page-level maximum widths inside `WorkspaceShell`; control density inside sections and cards.
- Use a card for one distinct section, then rows, tables, forms, or lists inside it. Do not put cards inside cards.

## Surfaces and elevation

- The canvas is a fixed `135deg` peach-to-blue CSS gradient, never an image.
- The outer workspace frame uses restrained translucency and blur.
- Cards use the semantic `card` color, a quiet border, and a soft shadow only when separation requires it.
- Popovers, menus, calendars, and selects use the more opaque `popover` surface.
- Hover elevation is limited to a subtle one-pixel translation or small shadow change. Static information cards do not need to move.

## Components and composition

Joint uses owned shadcn/ui components with the `radix-nova` style, Radix primitives, and Tailwind CSS semantic tokens. Generate component source with the shadcn CLI and treat it as project-owned code.

### Navigation and workspace

- Desktop navigation is icon-only with a clear active state and accessible label.
- Mobile navigation exposes the same primary destinations in the bottom bar.
- Navigation labels and route names must remain consistent across desktop, mobile, page titles, and tests.

### Cards, tables, and rows

- Use `Card`, `Table`, `Tabs`, `Badge`, `Separator`, and `Skeleton` for structured content.
- Settings and management screens use section cards with `CardHeader` and `CardContent`.
- Inside a settings card, use full-width rows with one muted leading icon, a label, optional short description, and exactly one right-side value or control.
- Do not repeat the row label as the control label. Name the setting on the left and use an action verb on the control, such as `Session` and `Log out`.
- Ordinary row controls use small selects, compact outline buttons, text values, or labelled icon buttons. Reserve primary fills for creation and destructive fills for irreversible actions.

### Forms and overlays

- Use `Field`, `FieldGroup`, and visible `FieldLabel` composition for forms.
- Use `ToggleGroup` for two to seven related choices.
- Use `Sheet` for desktop transaction entry and a full-height mobile presentation.
- Use `Popover` with the owned `Calendar` for dates; do not use the browser-native date picker in transaction entry.
- Use `AlertDialog` for irreversible deletion, removal, or archival unless a reliable undo path exists.
- Validation errors stay close to the field, receive focus when appropriate, and include a live status message for asynchronous submission.
- Empty states are concise and single-purpose; do not repeat the same message in a title, description, and body.

### Settings

- Appearance and account concerns use separate section cards.
- Session and partner-access controls are rows inside the `Account` card, not separate cards.
- Signing out is a session action, not a destructive action.
- Partner access uses an outline `Manage partner` control, an owned `Popover`, and destructive confirmation only for removal.
- Owners see one of three partner-access states: no authorization, pending sign-in, or joined partner. Pending and joined states expose removal rather than replacement; authorizing another email requires removing the current access first.

### Sign-in and access denial

- Google OAuth is the only sign-in path.
- An account without household membership or matching partner authorization returns to the login surface with a concise access-denied message after its local session is cleared.
- Do not present self-service household creation, onboarding, an invitation-token flow, or a retry loop that implies the account can grant itself access.

## Icons and data visualization

- Use Lucide as the only general-purpose icon package.
- Standard interface icons are 16–20px; primary navigation icons sit inside 44px targets.
- Icons supplement visible text. Icon-only controls require an accessible label and, where useful, a tooltip.
- Keep stroke weight and optical size consistent within a component family.
- Category spending uses labelled green or accent-toned bars. Income and expense comparisons use explicit values and direction labels.
- Every chart requires a textual or table equivalent. Decorative chart detail must not obscure the underlying numbers.

## Interaction and motion

- Provide distinct hover, pressed, open, selected, disabled, loading, error, and focus-visible states.
- Hover, pressed, and open states should increase contrast subtly and respond immediately.
- Animate transform and opacity only. Avoid large-distance movement, bounce, or layout-shifting effects.
- Honor `prefers-reduced-motion`; pending indicators must remain understandable without animation.
- Controls must not shift surrounding layout when hovered, opened, submitted, or when their label changes.

## Accessibility

- Every interactive control must be keyboard reachable and operable.
- Preserve visible `focus-visible` treatment; never remove an outline without an equivalent ring.
- Maintain at least 44px targets for mobile buttons, navigation items, segmented choices, and row actions.
- Labels must be programmatically associated with inputs.
- Loading, success, and error changes require appropriate live-region feedback.
- Do not use color, position, placeholder text, or icons as the only source of meaning.
- Support empty, loading, validation-error, server-error, reduced-motion, and keyboard-only states.

## Visible MVP contract

- The interface is English with logical-property-friendly layout so Hebrew and RTL can be added later.
- Joint has exactly one shared household balance: opening balance plus income minus expenses. The shared balance may be negative.
- The MVP accepts manual income and expenses only.
- The primary experience exposes that shared balance, categories, manual income and expenses, monthly reporting, recent activity, and partner access.
- Income and expense use a segmented choice.
- Expense entry identifies who paid and defaults to the signed-in household member.
- Multiple accounts, credit-card debt, transfers, budgets, recurring transactions, imports, labels, attachments, financial credentials, card numbers, and audit history remain outside the MVP unless a separately approved plan changes this contract.
