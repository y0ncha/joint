# Hide zero-spend analytics rows

## Scope

Keep Bills & Groceries charts zero-filled for a stable time axis. In their detail-page tables only, omit rows with no spending:

- Bills by month and Groceries by month: omit a month when its displayed total is zero.
- Year-over-year: omit a month when both displayed values are absent or zero.
- Groceries by day: omit a day when its displayed daily total is zero; calculate cumulative totals from the complete month before filtering.

When filtering leaves no rows, do not render the table. Show the relevant no-data message instead.

## Boundaries

This changes presentation only. It does not alter chart data, service-period proration, stored transactions, financial reporting, or the transaction ledger, whose valid amounts are positive.

## Verification

Add focused component coverage for omitted zero rows and retained nonzero/cumulative values, then run the focused suite and the full test suite. Confirm the Bills detail page in the browser with a no-data selection.
