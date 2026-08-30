# Small fixes: dashboard, transactions, and analytics

Status: approved; implementation in progress.

## Global Constraints

- The user-approved specification is the consolidated plan and browser annotations in this task.
- Stay on `feature/small-fixes`. No worktree creation, branch switching, pushes, deployment, database changes, new dependencies, or external API changes.
- Use sequential implementation subagents (`gpt-5.6-luna`, `xhigh`), independent task reviews for spec and quality, then a whole-branch review. Commit completed phases and preserve unrelated work.
- Use owned shadcn components, semantic tokens, keyboard access, and 44px controls. Preserve financial calculations except the explicitly incorrect tooltip sums.
- Update relevant design documentation before its implementation. Tests use existing Vitest infrastructure and synthetic data. No production build or hosted writes.
- Visual confirmation is required before Task 4 date behavior. Tasks 1–3 may proceed while that confirmation is pending.
- Run focused checks per task, then full local tests, lint, and typecheck. Verify desktop/mobile visuals, accent contrast, long amounts, keyboard and tooltip behavior. Report local proof separately from live proof.

## Task 1: Dashboard presentation

- Update the relevant dashboard design contract before changing code; avoid unrelated documentation cleanup.
- In `src/components/dashboard-monthly-trend.tsx`, put Monthly balance immediately below the tooltip month heading. Its label and amount are semibold in `text-primary`.
- Reorder this tooltip's payload locally, without mutation; preserve chart lines, legend, table, and calculations. Reuse ChartTooltipContent.
- In the dashboard budget row, show `₪400.00 spent of ₪500.00` below each budget name, using row.spent, row.monthlyBudget and existing detailCurrency. Preserve percentages, bars, info tooltips and empty states.
- Extend existing dashboard tests for rendered tooltip order/emphasis, zero and negative balance, visible decimal budget amounts and overspending. Test actual tooltip rendering rather than merely presence of a mock.
- Run focused tests, self-review, commit this phase, report evidence.

## Task 2: Transaction form presentation

- Update the relevant transaction design contract before changing code.
- In the shared TransactionSheet, move Merchant above Amount for create/edit; preserve errors, defaults, names and DOM/tab order.
- Placeholders: Amount `0.00`, Merchant `e.g. Supermarket…`, Note `Add an optional note…`. Do not change actual values or validation.
- Remove only the visible Recurring schedule heading. Show Repeat for create and linked recurring edits, retaining all recurrence controls and behavior.
- Remove the visible Billing period heading but retain accessible context. From and To use ordinary foreground label color, not muted text. Retain keyboard labels/IDs and date controls.
- Do not implement any date behavior from Task 4 yet; user visual confirmation is required first.
- Extend existing tests for placeholders, retained edit values, field order, hidden billing heading/context, visible Repeat and preserved recurrence controls before Note.
- Run focused tests, self-review, commit and report. Controller will present local visual results to the user.

## Task 3: Analytics tooltip correctness

- Update relevant analytics design contracts before changing code.
- Bills totals include only displayed spending series, not Average. Groceries totals include Main run + Top-ups, not Monthly budget.
- Average and budget rows remain visible references in tooltips. Total labels and amounts are bold in the selected accent, in the existing footer position.
- Add the smallest internal tooltip input selecting contributing series by data keys, never display labels. Keep generic chart code free of analytics-specific key names.
- Year-over-year has no total row locally: preserve current/previous-year values and the average reference; do not add a combined total.
- Make Bills and Year-over-year average lines solid. Keep Groceries budget and Home balance-average lines dashed. Preserve average values and opacity.
- Cover overview, mobile Bills variant and expanded chart views through their shared implementation.
- Extend existing tests with numeric tooltip totals (including nonzero averages/budget), reference rows, zero/missing values and selected subsets. Assert only requested line dash changes.
- Run focused tests, self-review, commit and report.

## Task 4: Transaction and billing date behavior

Prerequisite: explicit user visual confirmation after local Task 2 preview. Do not start until the controller confirms this gate is satisfied.

- Update date-default design contracts before code.
- For new month-filtered ledger transactions, default to today if viewing the current month; otherwise the first day of the viewed month.
- For custom ranges or entry points without a selected month, use today. Keep calendar opening month aligned with selected date. Reuse existing local-date/month utilities.
- Refresh defaults on ledger-month navigation and new-draft reset, without overwriting an actively edited date during ordinary re-renders. Existing edits retain their saved date.
- Initialize Bills periods lacking saved dates to first/last days of the transaction Date's month, in both draft initialization and Bills destination selection, using getIsoMonthRange.
- The calendar shortcut uses the selected transaction Date's full month; aria-label/title `Use selected date’s month`.
- Changing Date later preserves the billing period. Preserve saved/custom periods, ordered manual adjustments, and clearing on non-Bills/kind changes.
- Test with a frozen clock: current/past/future months, year boundaries, leap February, custom ranges, missing month, saved edits, month navigation/reset and submitted dates. Cover Bills initialization, destination selection, changed Date plus shortcut, saved/custom preservation, date ordering and non-Bills clearing.
- Run focused tests, self-review, commit and report.

## Completion

- Run full local tests, lint and typecheck, never production build. Review the complete branch and fix reviewed defects through subagents.
- Record evidence, decisions, commits and remaining verification limits. Add an unreleased changelog entry only when the approved plan is complete.
- No push, merge, deployment, or production writes.
