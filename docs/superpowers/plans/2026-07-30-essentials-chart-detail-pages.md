# Essentials Chart Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace laggy Essentials card expansion with four dedicated chart detail pages.

**Architecture:** Keep the existing fixture/chart composition in `essentials-dashboard.tsx`; parameterize it with an optional selected chart so the dashboard mounts all cards while a detail page mounts exactly one card and its table. Static App Router pages select each known chart. Remove the expansion state and `WorkspaceShell` immersive mode because routes replace that interaction.

**Tech Stack:** Next.js App Router, React, TypeScript, Recharts, shadcn/ui, Vitest, Tailwind CSS v4.

## Global Constraints

- Keep normal workspace chrome on detail pages.
- Keep controls local with their current defaults; add no query state or dependencies.
- Preserve fixture data and approved chart/table accessibility.
- Do not run `bun run build`.

---

### Task 1: Route-ready Essentials chart composition

**Files:**
- Modify: `src/components/essentials-dashboard.tsx`
- Test: `src/components/essentials-dashboard.test.tsx`

**Interfaces:**
- Produces: `EssentialsChartDetail({ chart: "bills" | "yoy" | "groceries" | "daily" })` for route pages.
- Preserves: `EssentialsDashboard()` for `/essentials`.

- [ ] **Step 1: Write failing static-render tests**

```tsx
expect(renderToStaticMarkup(<EssentialsDashboard />)).toContain('href="/essentials/daily"');
expect(renderToStaticMarkup(<EssentialsChartDetail chart="daily" />)).toContain('aria-label="Daily groceries data table"');
expect(renderToStaticMarkup(<EssentialsChartDetail chart="daily" />)).not.toContain("Bills by month");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `/Users/yonatan/.bun/bin/bun run test src/components/essentials-dashboard.test.tsx`

Expected: FAIL because the dashboard has no detail-route link or `EssentialsChartDetail` export.

- [ ] **Step 3: Implement the smallest shared composition**

```tsx
export function EssentialsDashboard() {
  return <EssentialsCharts />;
}

export function EssentialsChartDetail({ chart }: { chart: EssentialsChartId }) {
  return <EssentialsCharts detailChart={chart} />;
}
```

Render only `detailChart` when it is supplied, show its table, and replace the expand button with an accessible `Link` on dashboard cards.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `/Users/yonatan/.bun/bin/bun run test src/components/essentials-dashboard.test.tsx`

Expected: PASS.

### Task 2: Static detail routes and normal shell

**Files:**
- Modify: `src/app/(app)/essentials/page.tsx`, `src/app/(app)/essentials/page.test.tsx`, `src/components/workspace-shell.tsx`, `src/components/workspace-shell.test.tsx`, `src/app/globals.css`
- Create: `src/app/(app)/essentials/bills/page.tsx`, `src/app/(app)/essentials/year-over-year/page.tsx`, `src/app/(app)/essentials/groceries/page.tsx`, `src/app/(app)/essentials/daily/page.tsx`

**Interfaces:**
- Consumes: `EssentialsDashboard()` and `EssentialsChartDetail({ chart })`.
- Produces: four fixed App Router pages and a shell with no `immersive` prop.

- [ ] **Step 1: Write failing route/shell tests**

```tsx
expect(renderToStaticMarkup(<EssentialsPage />)).not.toContain("onExpandedChange");
expect(renderToStaticMarkup(<DailyEssentialsPage />)).toContain("Back to Essentials");
expect(renderToStaticMarkup(<WorkspaceShell title="Essentials"><p>Content</p></WorkspaceShell>)).not.toContain("hidden=\"\"");
```

- [ ] **Step 2: Run focused route and shell tests to verify they fail**

Run: `/Users/yonatan/.bun/bin/bun run test src/app/(app)/essentials/page.test.tsx src/components/workspace-shell.test.tsx`

Expected: FAIL because the route still owns expansion state and the shell still exposes `immersive`.

- [ ] **Step 3: Implement the static pages and delete obsolete transition behavior**

```tsx
export default function DailyEssentialsPage() {
  return (
    <WorkspaceShell title="Daily groceries" description="Daily spending, including no-spend days.">
      <EssentialsChartDetail chart="daily" />
    </WorkspaceShell>
  );
}
```

Remove `immersive` from `WorkspaceShell`, remove the View Transition CSS, and make `/essentials` render only `EssentialsDashboard` inside the normal shell.

- [ ] **Step 4: Run focused route and shell tests to verify they pass**

Run: `/Users/yonatan/.bun/bin/bun run test src/app/(app)/essentials/page.test.tsx src/components/workspace-shell.test.tsx`

Expected: PASS.

### Task 3: Full focused verification

**Files:**
- Modify: `docs/design.md`, `docs/plans/essentials-dashboard.md`

- [ ] **Step 1: Update the Essentials interaction contract**

Replace the expanded-card table wording with dedicated chart detail pages while preserving the dashboard chart-only default and daily horizontal scrolling.

- [ ] **Step 2: Run static checks**

Run: `/Users/yonatan/.bun/bin/bun run test src/components/essentials-dashboard.test.tsx src/app/(app)/essentials/page.test.tsx src/components/workspace-shell.test.tsx && /Users/yonatan/.bun/bin/bun run lint -- src/components/essentials-dashboard.tsx src/components/workspace-shell.tsx src/app/(app)/essentials`

Expected: PASS.

- [ ] **Step 3: Browser-check desktop and mobile**

Open `/essentials`, activate each chart’s detail control, confirm the matching title, chart, table, Back to Essentials control, normal navigation, internal daily scrolling, and restored dashboard after Back. Confirm the dashboard never mounts a table.
