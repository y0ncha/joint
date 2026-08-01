# Essentials chart detail pages

## Goal

Replace in-place chart expansion with one dedicated route per Essentials chart, so navigation mounts one chart at a time rather than rebuilding the dashboard grid.

## Route and layout

- Keep `/essentials` as the four-card preview dashboard.
- Add `/essentials/bills`, `/essentials/year-over-year`, `/essentials/groceries`, and `/essentials/daily`.
- Detail pages keep normal workspace navigation but omit the workspace header. The selected chart title and description are the only page heading; the selected chart and its accessible table use the full content area.

## Component behavior

- Reuse the existing fixture data, chart controls, chart primitives, and table markup.
- Dashboard cards link to their chart detail route through an accessible icon-only control. Detail cards place an accessible icon-only Back to Essentials control beside Configure.
- Detail-page controls use the existing local state and start at their current defaults. No query parameters or URL synchronization are added.
- Detail content has a more opaque surface. Its table omits row and outer borders but retains the chart-to-table separator.
- Remove expanded-card state, native View Transition handling, expanded-only CSS, and the `WorkspaceShell` immersive mode because the detail route replaces their only consumer.

## Verification

- Static tests cover preview links, chart-only dashboard cards, chart-table detail pages, normal workspace chrome, and no obsolete expansion APIs.
- Run focused page/component/shell tests, targeted lint, and browser-check dashboard-to-detail navigation on desktop and mobile.
