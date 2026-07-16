# Bills Tab and Analysis — Roadmap Brief

## Purpose

Give the household a calm, forward-looking view of known obligations and explain what is due, paid, overdue, or changing—without implying that Joint can see bank/card statements.

## Product shape

- Add a Bills tab for manually maintained household obligations, such as rent, utilities, subscriptions, or insurance.
- Each bill has a name, expected amount or amount range, cadence, next due date, optional category, and status (active, paused, paid, overdue).
- The main view prioritises upcoming bills, total expected in the next 30 days, overdue items, and a simple monthly comparison of expected versus manually confirmed expense transactions.
- Members explicitly mark a bill paid and may optionally create or link the matching manual expense; the interface must distinguish “expected” from “recorded”.
- Exclude creditor accounts, payment initiation, statement matching, payment reminders by email/SMS, and legal late-fee calculations in the first release.

## Rules and decisions

- Expected bills do not affect balance, expense totals, category spending, budgets, or card debt until linked to/created as a confirmed expense transaction.
- A bill's schedule is informational. “Overdue” means the household has not marked the expected occurrence paid—not that a payment institution confirms delinquency.
- Paid history is immutable enough to explain analysis; changing a bill updates future expectations only.
- Do not calculate cash-flow affordability from a shared balance alone. If shown, a forward-looking “known upcoming obligations” total is descriptive, not an available-to-spend amount.

## Technical direction

- Model bills separately from `transactions`, with household-scoped bill definitions and dated bill occurrences/settlement links. Add RLS, constraints, and generated types in a new migration.
- Reuse a pure date-schedule/reporting module where possible, but keep bill semantics separate from recurring expenses until a deliberate shared abstraction is designed.
- Build Server Component reporting from RLS-scoped data; use authenticated Server Actions for bill and occurrence state changes.
- Keep analysis deterministic and explainable: return the expected source, date range, linked transaction (if any), and status behind every aggregate.

## Validation and acceptance

- Test calendar boundaries, paid/overdue status, paused bills, expected-versus-recorded totals, and no impact on ledger balances before confirmation.
- Test household isolation, cross-household link rejection, accessible status labels, keyboard operation, and a non-colour table alternative.

## Dependencies and rollout

Requires the live ledger, categories, and dashboard report foundation. It may later integrate with recurring expenses, but should first ship as an independent manual bill model so the user can validate whether their real bills fit the workflow.

