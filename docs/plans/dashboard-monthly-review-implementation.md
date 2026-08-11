# Dashboard Monthly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved three-card financial review, adjacent spending changes, and accessible full-width three-line trend while removing the collapsed activity widget.

**Architecture:** Keep data reads in async server components and pass the six bounded monthly rows into one small client chart component. Reuse the existing summary and balance RPCs for custom-range values; calculate only the three prior range boundaries in TypeScript, then issue bounded balance reads in parallel.

**Tech Stack:** Next.js App Router, TypeScript, Bun/Vitest, Tailwind CSS v4, owned shadcn/ui, Recharts, Supabase SSR projections.

## Global Constraints

- Preserve the single shared household balance: opening balance plus income minus expenses.
- Do not add dependencies, change hosted Supabase state, or edit an applied migration.
- Use semantic tokens and existing shadcn components; charts must remain understandable without color.
- Custom range inputs remain server-validated and comparisons use exactly three preceding equivalent ranges when history exists.
- Preserve unrelated dirty work and the current branch.

---

### Task 1: Range comparison boundaries

**Files:**

- Modify: `src/lib/date-range.ts`
- Test: `src/lib/date-range.test.ts`

**Interfaces:**

- Consumes: `DateRange`, `inclusiveIsoDayCount()`, and `shiftIsoDate()`.
- Produces: `previousThreeDateRanges(range: DateRange): [DateRange, DateRange, DateRange]`, ordered newest to oldest.

- [ ] **Step 1: Write the failing test**

Add a literal expectation proving that `01/07/2026–15/07/2026` produces `16/06/2026–30/06/2026`, `01/06/2026–15/06/2026`, and `17/05/2026–31/05/2026`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/date-range.test.ts`

Expected: FAIL because `previousThreeDateRanges` is not exported.

- [ ] **Step 3: Write minimal implementation**

Use the existing inclusive day-count and UTC ISO-date shifting helpers in one three-item `Array.from()` expression. Do not add a date dependency or configurable count.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/date-range.test.ts`

Expected: PASS.

### Task 2: Monthly trend component

**Files:**

- Create: `src/components/dashboard-monthly-trend.tsx`
- Create: `src/components/dashboard-monthly-trend.test.tsx`

**Interfaces:**

- Consumes: `DashboardMonthlyReviewRow[]` with `month`, `income`, `expenses`, and `sharedBalance`.
- Produces: `DashboardMonthlyTrend({ data })`, a client component containing the owned chart and equivalent table.

- [ ] **Step 1: Write the failing test**

Render six literal rows and assert visible labels for Income, Outgoings, and Shared balance; exact accessible table values; six month labels; a Recharts accessibility layer; and no custom SVG trend path.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/dashboard-monthly-trend.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal implementation**

Compose `ChartContainer`, `LineChart`, `CartesianGrid`, `XAxis`, `YAxis`, `ChartTooltip`, `ChartLegend`, three `Line` elements, and the owned `Table`. Give the lines semantic token colors and distinct solid, dashed, and dotted strokes. Format ticks compactly and tooltips/table cells with `Intl.NumberFormat`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/dashboard-monthly-trend.test.tsx`

Expected: PASS.

### Task 3: Dashboard composition and focused reads

**Files:**

- Modify: `src/app/(app)/page.tsx`
- Modify: `src/lib/dashboard-read-model.ts`
- Test: `src/app/(app)/page.test.tsx`
- Test: `src/lib/dashboard-read-model.test.ts`

**Interfaces:**

- Consumes: one shared `Promise<DashboardMonthlyReviewRow[]>`, `getDashboardSummary(options)`, `getDashboardBalance(options)`, and `previousThreeDateRanges()`.
- Produces: `DashboardMetricCards`, `DashboardTrendCard`, and the approved 12-column layout.

- [ ] **Step 1: Write the failing tests**

Assert three equal metric cards, each value and comparison copy, donut/change adjacency, the full-width trend, removal of Latest activity, and one shared monthly-review read. Add a custom-range fixture asserting summary/balance options plus the three literal prior ranges. Update the read-model test to prove monthly review and category-change mapping.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- 'src/app/(app)/page.test.tsx' src/lib/dashboard-read-model.test.ts`

Expected: FAIL on the old combined Savings card, single-line SVG, and Latest activity widget.

- [ ] **Step 3: Write minimal implementation**

Delete the unused Income, Outgoings, Balance, Savings, BalanceTrend, and RecentActivity implementations. Add one metric-card renderer, derive monthly averages from rows `-4..-2`, and for a custom range reuse summary percentages while averaging three parallel prior balance reads. Pass the shared monthly rows into the trend component. Place metric cards at `lg:col-span-4`, spending at `lg:col-span-5`, changes at `lg:col-span-7`, and trend at `lg:col-span-12`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- 'src/app/(app)/page.test.tsx' src/lib/dashboard-read-model.test.ts src/components/dashboard-monthly-trend.test.tsx src/lib/date-range.test.ts`

Expected: PASS.

### Task 4: Loading shape, design contract, and verification

**Files:**

- Modify: `src/app/(app)/dashboard-loading.tsx`
- Modify: `src/app/(app)/dashboard-loading.test.tsx`
- Modify: `docs/design.md`
- Test: focused files above.

**Interfaces:**

- Consumes: final dashboard grid spans and card titles.
- Produces: membership fallbacks matching the final layout and durable design documentation.

- [ ] **Step 1: Write the failing loading test**

Assert loading cards for Income, Outgoings, Shared balance, Where your money went, Largest changes, and Six-month trend with the same spans as final content; assert Latest activity is absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- 'src/app/(app)/dashboard-loading.test.tsx'`

Expected: FAIL because the fallback still contains Latest activity and the old layout.

- [ ] **Step 3: Implement the fallback and contract update**

Mirror the final grid with existing `DashboardCardLoading` components and replace the obsolete dashboard-loading paragraph in `docs/design.md` with the approved card, trend, comparison, and accessibility contract.

- [ ] **Step 4: Run local verification**

Run: `bun run format:check && bun run lint && bun run typecheck && bun run test`

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 5: Validate in Browser**

Reload `http://localhost:3000/`; inspect the default desktop view, a mobile viewport, and one custom range. Confirm no horizontal overflow, the ordered layout and chart details are visible, keyboard chart semantics are present, and the console has no errors. Reset temporary viewport overrides when finished.
