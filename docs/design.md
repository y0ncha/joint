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

| Role               | Value                       | Usage                                                          |
| ------------------ | --------------------------- | -------------------------------------------------------------- |
| Canvas start       | `#f6d4b8`                   | Warm top-left of the fixed application gradient.               |
| Canvas middle      | `#b5cad0`                   | Cool transition through the canvas.                            |
| Canvas end         | `#0d4f73`                   | Deep-blue lower edge of the canvas.                            |
| `background`       | `#f6d4b8`                   | Fallback page background.                                      |
| `foreground`       | `#17201d`                   | Primary text and high-emphasis icons.                          |
| `card`             | `rgba(255, 252, 247, 0.92)` | Main floating surfaces.                                        |
| `popover`          | `#fffdfb`                   | Fully opaque, neutral menus, calendars, selects, and popovers. |
| `muted-foreground` | `#58635e`                   | Supporting text and quiet icons.                               |
| `border`           | `rgba(23, 32, 29, 0.12)`    | Low-contrast boundaries and dividers.                          |
| `positive`         | `#0f6b54`                   | Positive financial values.                                     |
| `negative`         | `#9e3e35`                   | Negative financial values.                                     |
| `destructive`      | `#9e3e35`                   | Irreversible actions and destructive context.                  |

Color must reinforce meaning rather than carry it alone. Text, values, labels, or icons must communicate the same meaning without color.

### Personal accent color

Each browser selects its accent from the fixed `react-color` CirclePicker preset palette. The preference is stored locally as `joint-accent`; it is not shared household data. The selected accent may change primary actions, neutral emphasis, chart steps, focus rings, and active navigation. It must not change positive, negative, expense, or destructive meaning. Accent selection does not offer a custom hex input.

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
- Popovers, menus, calendars, and selects use the fully opaque, neutral `popover` surface.
- Hover elevation is limited to a subtle one-pixel translation or small shadow change. Static information cards do not need to move.

## Components and composition

Joint uses owned shadcn/ui components with the `radix-nova` style, Radix primitives, and Tailwind CSS semantic tokens. Generate component source with the shadcn CLI and treat it as project-owned code.

### Navigation and workspace

- Desktop navigation is icon-only with a clear active state and accessible label.
- Mobile navigation exposes the same primary destinations in the bottom bar.
- Desktop and mobile primary navigation include `/bills-groceries`; desktop follows the existing icon-only pattern with the accessible label `Bills & Groceries`, while mobile exposes the visible destination label.
- The desktop rail ends with a non-interactive avatar that shows the signed-in user's cached profile-name initials. It has no notification badge, popover, or notification behavior.
- Navigation labels and route names must remain consistent across desktop, mobile, page titles, and tests.

### Cards, tables, and rows

- Use `Card`, `Table`, `Tabs`, `Badge`, `Separator`, and `Skeleton` for structured content.
- Settings and management screens use section cards with `CardHeader` and `CardContent`.
- Inside a settings card, use full-width rows with one muted leading icon, a label, optional short description, and exactly one right-side value or control.
- Do not repeat the row label as the control label. Name the setting on the left and use an action verb on the control, such as `Session` and `Log out`.
- Ordinary row controls use small selects, compact outline buttons, text values, or labelled icon buttons. Reserve primary fills for creation and destructive fills for irreversible actions.
- Pills are compact labelled `Badge` capsules with a one-pixel low-contrast border. Income and expense use fixed semantic positive and negative colors; unassigned and uncategorized use neutral gray; member and category pills use their shared household pastel color. Pills always include their text label; color is supplemental.
- The ledger card header has one subtle, labelled gear button. Its right-side Sheet contains sorting plus type, category, and payer filters; active filters remain visible through the URL. Every filter choice and sort trigger has a 44px minimum target. Month and year selectors sit above the ledger beside a custom-range button that opens the owned Calendar range picker; a selected range, including one day, replaces the month scope. Ledger rows always expose warm-neutral checkboxes that use the selected accent when checked, plus a destructive bulk-delete action that always requires confirmation.

### Forms and overlays

- Use `Field`, `FieldGroup`, and visible `FieldLabel` composition for forms.
- Browser autofill preserves the established text-input surface; it must not repaint inputs blue.
- Use `ToggleGroup` for two to seven related choices. Ledger transaction type uses a checkbox multiselect with both types selected by default; it never permits an empty selection.
- `Uncategorized` is the unified unset state; the category menu groups colored subcategory pills beneath muted parent-category headings; explicit assignment wins over automation; and empty search sections are not rendered. Ledger type and payer filters use compact checkbox multiselects without search. Ledger month, year, and sorting use regular selects in chronological order.
- A transaction type change clears an incompatible assignment instead of silently substituting one. New manual transactions may leave the category `Uncategorized`: a matching merchant automation then assigns an eligible non-Bills destination, otherwise save keeps the existing category validation error. An explicit selection always wins; imports and transactions whose category is deleted may remain `Uncategorized`.
- Transaction entry prioritizes amount, then follows the ledger order: date, type, payer, category, merchant, and notes. The ledger shows `Merchant`; notes remain in the transaction Sheet.
- Use `Sheet` for desktop transaction entry and a full-height mobile presentation.
- Merchant-rule creation and editing use a condition builder in the existing right-side `Sheet`: members choose `Match all (AND)` or `Match any (OR)`, add one or more conditions, and select `Merchant`, `Note`, or `Amount`. Merchant and Note use literal text operators; Amount uses numeric comparison operators and a decimal input. The existing action outcome remains below the condition group. Enabled is managed from the ordered rule list, not inside the creator/editor Sheet. The visible `Add rule` action uses the same labelled button treatment and height as other workspace add actions.
- Use `Popover` with the owned `Calendar` for dates; do not use the browser-native date picker in transaction entry.
- A selected Bills subcategory reveals a `Billing period` range control. It uses inclusive ISO dates, defaults to the transaction date, and clears when a non-Bills subcategory is selected; the period is for Bills & Groceries analytics only.
- Use `AlertDialog` for irreversible deletion, removal, or archival unless a reliable undo path exists.
- Validation errors stay close to the field, receive focus when appropriate, and include a live status message for asynchronous submission.
- Empty states are concise and single-purpose; do not repeat the same message in a title, description, and body.

### Settings

- Appearance, household, and account concerns use separate section cards, in that order.
- The `Household` card contains the owner-editable household name, Categories and Automations links, and an optional `Monthly groceries budget` `Field` with an `Input`, all available to both members; it also contains owner-only partner-access controls. Members may view the household name but cannot edit it. Clearing the budget saves no budget, hides the Bills & Groceries chart threshold, and does not block the route.
- User name, user color, card mapping, and session controls are rows inside the `Account` card, not separate cards. A header Save control atomically persists changed user name, household name, user color, and monthly groceries budget. A member can edit only their own display name. A saved change updates their profile and desktop avatar initials. Header Log out confirms leaving when settings are unsaved.
- A member may select only their own user color from Account. User colors and the browser-local accent use fixed `react-color` CirclePicker presets with no custom hex input. Categories retain the final `Custom color` circle that opens a BlockPicker, including its hex input. User colors remain labelled supplemental visuals; the accent never changes financial or destructive semantics. New members receive the next available pastel until they change it.
- Only the household owner sees the `Members` field with the `UsersRound` icon, a short management description, and an accessible icon-only edit control. It opens the established right-side Sheet with read-only owner and partner-access cards. Joined household summaries show both people with avatars, display names (falling back to the known email), email, and joined date; do not show card mappings, colors, or role pills. The owner may invite one Google email, or remove a pending or joined partner after confirmation; authorizing another email requires removal first. A member never sees household member details or controls in Settings.

### Sign-in and access denial

- Google OAuth is the only sign-in path.
- An account without household membership or matching partner authorization returns to the login surface with a concise access-denied message after its local session is cleared.
- Do not present self-service household creation, onboarding, an invitation-token flow, or a retry loop that implies the account can grant itself access.

## Icons and data visualization

- Use Lucide as the only general-purpose icon package.
- Standard interface icons are 16–20px; primary navigation icons sit inside 44px targets.
- Icons supplement visible text. Icon-only controls require an accessible label; buttons do not use tooltips.
- Keep stroke weight and optical size consistent within a component family.
- Category spending uses labelled green or accent-toned bars. Income and expense comparisons use explicit values and direction labels.
- Bills & Groceries uses the owned shadcn `Chart` primitive backed by Recharts, plus existing `Card`, `Popover`, `Calendar`, `Field`, `Input`, `PillSelect`, and semantic tokens; do not create a chart framework or add another visualization dependency.
- Bills & Groceries shows `Bills by month`, `Year-over-year`, `Groceries by month`, and `Groceries by day`: at the shared `xl` viewport threshold, the Bills cards appear in one row and the Groceries cards in a second row with the monthly chart filling the remaining width and the day heatmap squarish; smaller layouts stack them in that order. Its configuration popover switches monthly charts between `Past 12 months` and `Calendar year`; Bills selectors retain a non-empty selection, and daily Groceries ranges use the owned Calendar and retain every selected date in a total-spend calendar heatmap.
- Monthly charts have labelled axes, exact ILS tooltips, visible text legends, non-color labels, and keyboard-accessible chart layers. The Groceries-by-day heatmap has weekday labels, a total-spend intensity legend, keyboard-focusable day cells with exact ILS values, and an equivalent table that retains the Main run/Top-ups split. The `/bills-groceries` dashboard is chart-only; each chart has a dedicated full-content detail page with its accessible table of the same values. Detail content uses a more opaque surface; its table keeps muted horizontal row dividers and the chart-to-table separator, without an outer border. The chart title and description are the page heading, and an icon-only Back control sits beside the configuration control. Decorative chart detail must not obscure the underlying numbers.

## Interaction and motion

- Provide distinct hover, pressed, open, selected, disabled, loading, error, and focus-visible states.
- Every hoverable component uses the same muted foreground tint (`bg-foreground/5`); hover, pressed, and open states should increase contrast subtly and respond immediately. Icon buttons use `bg-foreground/10` while pressed or open, without movement.
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
- Chart focus, tooltips, legends, and equivalent tables must remain usable with a keyboard, without color, and with reduced motion.

## Visible MVP contract

- The interface is English with logical-property-friendly layout so Hebrew and RTL can be added later.
- Joint has exactly one shared household balance: opening balance plus income minus expenses. The shared balance may be negative.
- The MVP accepts manual income and expenses plus authenticated CSV/XLSX statement imports using the documented Hebrew export format.
- The primary experience exposes that shared balance, categories, manual income and expenses, statement imports, monthly reporting, recent activity, partner access, and Bills & Groceries analytics.
- Income and expense use a dropdown choice.
- Expense entry may identify a household member who paid and defaults to the signed-in member; `Unassigned` is an explicit valid state for both manual and imported transactions.
- Imported transactions may remain `Uncategorized`. Opening an imported transaction lets a member assign a matching category later, change it, or return it to `Uncategorized`; import itself never asks for a category.
- Household members may configure ordered automations. A rule either replaces a matching merchant with one literal normalized name or assigns an eligible non-Bills subcategory or direct `Other` category. Conditions can match Merchant, Note, and numeric Amount with an AND/OR group. Both actions may apply to a new transaction, priority is visible and user-controlled, and existing transactions change only after preview and confirmation.
- Bills and Groceries are protected expense categories. Bills transactions require an inclusive billing period for Bills & Groceries-only prorated analytics; the ledger, reports, and shared balance continue to use the exact stored amount and posting date. Groceries has the protected `Main run` and `Top-ups` subcategories and supports one optional fixed monthly household budget for its Bills & Groceries threshold.
- A member may optionally save one card's last four digits during onboarding or later in Settings, and may replace only their own saved digits. Imports snapshot a recognized mapping into the newly saved transaction's payer; changing the mapping never changes an existing transaction's payer. Unmatched cards remain unassigned. Full card numbers, bank connections, card accounts, transfers, generalized budgets, recurring transactions, attachments, financial credentials, and audit history remain outside the MVP unless a separately approved plan changes this contract.
