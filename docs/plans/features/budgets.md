# Budgets — Roadmap Brief

## Purpose

Help the household set a monthly spending intention and see progress early, without turning Joint into a personal-finance optimisation tool. A budget is shared household context, never a judgement of either partner.

## Product shape

- Let members create a monthly total budget and optional expense-category budgets for a selected month.
- The dashboard shows spent, remaining, and forecast status with amounts and clear text; colour is secondary to labels.
- Categories with no budget remain visible in spending, but are not treated as over budget.
- Archived categories retain their historical budget and spending context.
- Start with manual monthly amounts. Do not add rollover, envelope allocation, personal budgets, income targets, or automatic budget recommendations.

## Rules and decisions

- Budgets apply only to expense transactions in the household's selected calendar month; income and transfers never count toward spending.
- Category budget totals may exceed or fall below the total household budget. The UI must state the difference rather than silently reconciling it.
- A budget is a plan, not an accounting entry: changing it never changes balances, transactions, or category totals.
- Both household roles may manage budgets, consistent with existing transaction/category permissions.

## Technical direction

- Add household-scoped monthly budget records through a new ordered Supabase migration, RLS policies, generated database types, and authenticated Server Actions.
- Store positive ILS numeric values to two decimal places, a `month` (`YYYY-MM`), and an optional expense-category reference. Enforce one total and one category budget per household/month/category combination.
- Extend the pure monthly-report layer with budget-versus-actual inputs and output. Keep selected-month reporting and balance-as-of-month-end semantics unchanged.
- Use Server Components for data loading and a small client form only where month/category selection needs interaction. Follow existing shadcn and semantic-token conventions.

## Validation and acceptance

- Unit-test budget validation, selected-month boundaries, category aggregation, archived-category history, and transfer exclusion.
- Action/RLS tests prove a member cannot read or mutate another household's budgets.
- UI tests cover no-budget, under-budget, near-limit, over-budget, validation, keyboard, and mobile states.

## Dependencies and rollout

Build only after the live categories, transactions, and dashboard reporting MVP is complete. It is independent of CSV digesting and AI labelling; recurring-expense planning may later prefill a suggested budget but must not create one automatically.

