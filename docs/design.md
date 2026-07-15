# Joint — Design System

## Product intent

Joint is a calm, shared household-money workspace for two people. It makes the shared balance, current-month income and spending, and category spending immediately understandable without becoming a bank clone.

## Visual direction

- Use a warm peach-to-cool-blue CSS canvas gradient, never an image background.
- Float a small number of off-white, translucent panels over that canvas. Cards use a restrained backdrop blur and soft shadow; nested glass cards are prohibited.
- Stay light-first for the MVP. Do not ship a dark-mode toggle.
- Use Geist Sans for interface text and Geist Mono for amounts, dates, and transaction metadata.
- Favor calm operational density over marketing composition: the app should read as a quiet money workspace, not a landing page.
- Every new surface should look like it belongs to one of the existing families below before introducing a new pattern.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `canvas-start` | `#f6d4b8` | warm top-left canvas |
| `canvas-mid` | `#b5cad0` | transition canvas |
| `canvas-end` | `#0d4f73` | deep blue canvas |
| `surface` | `rgba(255, 252, 247, 0.84)` | floating panels |
| `ink` | `#17201d` | primary text |
| `muted` | `#58635e` | supporting text |
| `primary` | `#0f6b54` | actions and positive financial data |
| `primary-soft` | `#b9dccb` | secondary green data |
| `expense` | `#9e3e35` | expense and destructive context |
| `border` | `rgba(23, 32, 29, 0.12)` | quiet boundaries |

All text and controls must meet WCAG AA contrast. Color reinforces meaning; labels, icons, and values carry the meaning independently.

### Personal accent preference

- Let each person select one of five curated accents: Mint, Sky, Lilac, Clay, or Blush.
- The selection changes actions, neutral data emphasis, chart steps, and keyboard focus. It must not change semantic positive, negative, expense, or destructive colors.
- Store this non-financial preference locally as `joint-accent` in the browser; it is not a shared household setting in the MVP.
- Palette controls must name every option in text; a color dot alone is insufficient.

## Layout

- Desktop uses a narrow left rail and a twelve-column content grid.
- Mobile uses a compact top bar and bottom navigation; main actions remain reachable with one hand.
- Use comfortable density: `gap-6`, `p-6`, and `text-sm` as the baseline.
- The dashboard prioritizes shared balance, monthly income/outgoings, category spending, simple visual summaries, and recent transactions.
- The MVP exposes one shared balance. Multiple accounts and credit-card tracking may be added later, but they are not visible navigation or transaction-entry concepts in this release.
- Desktop shell: the logo, page eyebrow, and page title align to the same top rhythm. The left rail is narrow, icon-only, and quiet except for the active route.
- All app tabs share the available workspace content width. Dashboard grids, settings cards, and management cards must not introduce route-specific page-level maximum widths; control density within cards instead.
- Do not put cards inside cards. Use a card for a distinct section, then rows, tables, forms, or lists inside it.

## Components and interactions

Joint uses shadcn/ui with the current `radix-nova` style and Radix primitives. Generate owned component source with the shadcn CLI; do not treat shadcn as an opaque dependency.

- Use `Card`, `Button`, `Badge`, `Table`, `Tabs`, `DropdownMenu`, and `Skeleton` for dashboard and ledger surfaces.
- Use `Sheet` for desktop transaction entry and a full-screen mobile form.
- Use `Input`, `Select`, `Textarea`, `Popover`, `Calendar`, and `Label` for data entry.
- Use `AlertDialog` for deleting transactions, accounts, and categories.
- Use Lucide icons at 16–20px and provide accessible labels/tooltips.
- Settings and management screens use section cards with `CardHeader` and `CardContent`. Inside a card, use full-width rows with a muted leading icon, a label, optional short description, and exactly one right-side value or control.
- Settings rows must not repeat the same words as both the row label and the control. Name the setting on the left, put the action verb on the control. Example: row label `Session`, button `Log out`.
- Row controls are visually quiet: small selects, compact outline buttons, text values, or icon buttons with labels. Avoid introducing large pills, primary fills, or destructive fills in ordinary settings rows.
- Account-related settings live in one `Account` card. Session controls and household-access invitation forms are subsections inside that card, not separate cards.
- Reserve the destructive button treatment for irreversible delete/archive actions, and pair those actions with `AlertDialog` unless there is an undo path. Signing out is a session action, not a destructive action.
- Primary filled buttons are for the main creation action in a form or sheet. Secondary/outline buttons are for local controls, copy actions, filters, and session actions.
- Popovers must be readable over the translucent canvas: use the popover token, enough opacity to hide page text underneath, and a bounded scrolling region for long content.
- Empty states should be concise and single-purpose. Do not say the same empty state in a heading, description, and body card.
- Income and expense use a segmented control. Transfers are not part of the visible MVP.
- Transaction entry uses one internal shared-balance account, selected by the server. Users do not choose bank or card accounts in the MVP.
- Transaction entry defaults the date to today and uses the owned `Calendar` inside a styled `Popover`, not the browser-native date picker.
- Expense entry includes a household member selector labelled by who paid, defaulting to the signed-in user.

## Interaction states

- All interactive controls need visible focus via the existing shadcn focus-ring language. Do not remove outlines unless there is a `focus-visible` replacement.
- Keep 44px mobile targets for buttons, row actions, icon controls, and segmented choices, even when the visual treatment is compact.
- Hover, pressed, and open states should increase contrast subtly. Prefer immediate pressed/open feedback for controls like popovers and accent selectors.
- Motion is gentle: animate transform and opacity only, honor reduced motion, and avoid jumpy or large-distance movement.
- Controls in a row should not shift surrounding layout when hovered, pressed, opened, or when their label changes.

## Charts and states

- Category spending uses green-toned bars or doughnut slices with explicit labels and amounts. The dashboard also includes at least one income-versus-expense visual summary.
- Provide a textual/table alternative for chart data.
- Support empty, loading, validation-error, server-error, focus-visible, keyboard, 44px touch-target, and reduced-motion states.

## Locale and boundaries

- UI is English in the MVP with Israeli `₪` currency and `DD/MM/YYYY` dates.
- Keep directional layout logical-property friendly so Hebrew/RTL can be added later.
- Do not include multiple visible accounts, credit-card debt, transfers, budgets, recurring transactions, imports, labels, attachments, financial credentials, card numbers, or audit-history UI in this release.
