# Bills & Groceries Analytics

## Purpose

Bills & Groceries is a household-scoped analytics view over the existing ledger. It adds a protected taxonomy, optional Bills service periods, and an optional shared Groceries budget. It does not replace the stored transaction model: the ledger and shared balance continue to use each transaction's positive stored amount, `kind`, and `occurred_on` posting date.

## Trust boundary and persistence

```text
Authenticated member
  → protected App Router page or Server Action
  → member request context derived from verified claims
  → Supabase query/RPC scoped to that member's household
  → Postgres constraints, triggers, and RLS
```

`getBillsGroceriesData` obtains the household ID from `getCurrentHouseholdContext`; it never accepts one from the URL or browser state. It rejects a non-member context before issuing a query. RLS remains the final household-data boundary.

The shared Groceries budget is `households.groceries_monthly_budget`: an optional, positive finite ILS numeric value with at most two decimal places and a value below `10000000000`. The Settings Server Action validates the submitted field, calls the authenticated `save_current_settings` RPC, and revalidates the dashboard only after a successful write. The five-argument RPC derives the caller and household from `auth.uid()`, delegates the existing settings update atomically, then stores the current household's budget. It is executable by `authenticated`, not `anon`.

## Authorized reset and protected taxonomy

The Essentials migration deliberately began with the one authorized destructive reset: it truncates `transactions` and `categories` with dependent subcategories, while retaining household identity, membership, access, member-card, and opening-balance data. It then seeds every existing household and the household-creation trigger seeds every future household in the same transaction.

Each household has one protected active expense category identified by `system_key` rather than its display name:

- `bills` — `Bills`
- `groceries` — `Groceries`, with exactly `main_run` (`Main run`) and `top_ups` (`Top-ups`) children

Partial unique indexes enforce one protected key per household. Database constraints and triggers prevent deletion, archival, renaming, re-parenting, kind changes, or `system_key` changes for protected rows. They still allow appearance customization. Bills may have ordinary, user-managed children; Groceries admits no children beyond its two protected ones. The private trigger helpers have an empty `search_path` and are not executable by application roles.

## Ledger source and analytics projection

`occurred_on` and the stored amount remain the source of truth for the ledger, shared balance, and Groceries reporting. Groceries monthly and daily charts group only the two protected children by posting date, zero-fill the selected window, and convert ILS amounts to integer agorot for calculation.

A Bills transaction additionally requires inclusive `service_period_start` and `service_period_end`. The database requires both dates together, ordered, and no longer than 366 calendar days; it rejects service periods on non-Bills transactions. The transaction action derives whether a chosen subcategory belongs to Bills from the server-side household query, requires the period only for Bills, and clears forged periods for other categories. The database trigger repeats the invariant for every write path and clears a former Bill period when an update removes its subcategory.

Bills proration is analytics-only. `allocateBillDaily` splits the stored amount over inclusive UTC service dates in integer agorot, gives any remainder to earliest dates, clips to the displayed range, and then consolidates by month and Bills child. It never writes an allocation, changes `occurred_on`, or changes the stored amount. The previous-year comparison is a view of those projected monthly values, not a separate persistence model.

## Bounded data and URL state

The loader uses compact, household-scoped reads instead of `getDashboardData()`:

- Protected categories and active child IDs are resolved by `system_key`.
- Bills reads only amount, child ID, and service-period columns whose inclusive periods overlap the displayed window plus its previous-year comparison window.
- Groceries reads only amount, posting date, and child ID for the displayed monthly range and selected daily month.

The route accepts `period`, `bills`, `bill`, `groceryMonth`, and the client-side daily `grocery` filter. It accepts only `rolling` or `calendar`, valid current Bills child IDs, and a valid calendar month; invalid or empty values fall back to all Bills, the deterministic default child, and the current month. The daily filter accepts `main-run` or `top-ups` and otherwise shows both. The main route canonicalizes the server-loaded values and removes legacy daily-range parameters. `src/lib/bills-groceries-navigation.ts` owns client URL construction, presentation-state fallbacks, and navigation classification. Updates containing `period` or `groceryMonth` use Next navigation so the server reloads bounded data; `bills`, `bill`, and `grocery` updates use native history so the existing server payload is filtered in place and browser back/forward remains synchronized. Both paths preserve unrelated and repeated query parameters.

## Accessible charts and failure behavior

The three Recharts bar charts expose labelled regions, Recharts' accessibility layer, keyboard-inspectable values, and visible legends and tooltips. The daily heatmap is instead a labelled keyboard-focusable grid whose cells expose each date and amount through `title` and `aria-label`, with a text lower-to-higher legend. Each chart's detail route adds an accessible labelled data table; the table is intentionally not rendered in the compact dashboard cards. Empty Bills data and missing prior-year data render explicit text, and an unset Groceries budget links to Settings instead of inventing a threshold.

Member-context and query failures cause the loader to throw an `Error`; the Bills & Groceries routes do not catch it or define a route-local error boundary. Transaction and settings validation failures return structured field/form errors; persistence failures return sanitized messages and do not revalidate routes. Database constraints and RLS still reject invalid or cross-household writes if application validation is bypassed.

## Primary sources

- [`supabase/migrations/20260730125519_essentials_dashboard.sql`](../../supabase/migrations/20260730125519_essentials_dashboard.sql)
- [`src/lib/bills-groceries-data.ts`](../../src/lib/bills-groceries-data.ts)
- [`src/lib/bills-groceries.ts`](../../src/lib/bills-groceries.ts)
- [`src/app/actions/transactions.ts`](../../src/app/actions/transactions.ts)
- [`src/app/actions/profile.ts`](../../src/app/actions/profile.ts)
- [`src/app/(app)/bills-groceries/page.tsx`](<../../src/app/(app)/bills-groceries/page.tsx>)
- [`src/components/bills-groceries-dashboard.tsx`](../../src/components/bills-groceries-dashboard.tsx)
- [`supabase/tests/shared_balance.sql`](../../supabase/tests/shared_balance.sql)
- [`src/lib/bills-groceries.test.ts`](../../src/lib/bills-groceries.test.ts)
- [`src/lib/bills-groceries-data.test.ts`](../../src/lib/bills-groceries-data.test.ts)
- [`src/app/actions/transactions.test.ts`](../../src/app/actions/transactions.test.ts)
- [`src/app/actions/profile.test.ts`](../../src/app/actions/profile.test.ts)
- [`src/components/bills-groceries-dashboard.test.tsx`](../../src/components/bills-groceries-dashboard.test.tsx)

## Non-goals

- This mechanism does not alter shared-balance accounting, stored transaction amounts, or ledger posting dates.
- It does not persist daily allocations, proration results, chart selections, or a separate Bills budget.
- It does not introduce unbounded dashboard reads, database aggregates, RPC analytics, or materialized analytics tables.
- It does not define the dashboard's visual language or report browser, hosted, or deployment verification.
