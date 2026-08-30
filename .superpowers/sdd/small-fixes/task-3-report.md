# Task 3 report: Analytics tooltip correctness

## Implemented

- Added the generic `totalDataKeys` input to the shared shadcn chart tooltip. When supplied, the footer total sums only payload items whose Recharts `dataKey` is listed; omitted keys, reference lines, zero values, missing values, and `type="none"` entries do not inflate the total.
- Wired Bills totals to the selected Bill data keys and Groceries totals to `mainRun` and `topUps`. Average, 3-month average, and Monthly budget remain visible payload rows.
- Made Bills and Year-over-year average lines solid while retaining the existing Groceries budget dash and Home balance-average dash, values, and opacity.
- Styled tooltip Total labels and values with `font-bold text-primary`.
- Updated the Analytics design contract and extended analytics tests for numeric totals, reference rows, zero/missing values, excluded selected-subset values, and line dash behavior.

## Tests and checks

- `bun run test -- src/components/analytics-dashboard.test.tsx src/components/dashboard-monthly-trend.test.tsx src/components/gas-trend-card.test.tsx` — 3 files, 38 tests passed.
- `bun run test` — 86 files, 711 tests passed.
- `bun run lint` — passed with no output.
- `bun run format:check` — passed: all matched files use Prettier code style.
- `git diff --check` — passed.
- Controller browser verification reported Bills `Total ₪443.25` with `Average ₪872.80`, Groceries `Total ₪270.00` with budget `₪280.00`, selected accent styling, and only Groceries retaining the dashed analytics line among the three checked lines.

## Files changed

- `docs/design.md`
- `src/components/ui/chart.tsx`
- `src/components/analytics-dashboard.tsx`
- `src/components/analytics-dashboard.test.tsx`
- `.superpowers/sdd/small-fixes/task-3-report.md`

## Self-review

- The allowlist is generic and compares only `dataKey` values; no analytics-specific names were added to shared chart code.
- Bills has two responsive chart instances, and both receive the same selected-key allowlist through the shared wrapper.
- Year-over-year remains without a total row, and Home tooltip ordering remains local to its existing wrapper.
- No database, dependency, build, deployment, branch, or external file changes were made. Existing Home work in `7af6bd3` was preserved.
- No remaining concerns.
