# Other direct categories

## Goal

Give every household two protected fallback categories: one for income and one for expenses. Both are presented as `Other` in the UI, use the existing grey family anchor (`#d5d5c4`), have no subcategories, and can receive manual transactions directly.

## Scope

- Keep every existing category subcategory-only.
- Add internal category system keys `other_income` and `other_expense`; both have the stored name `Other`, grey color, and a neutral existing icon.
- Seed both rows for existing households and when a household is created. They are neither editable, archivable, nor deletable.
- Add nullable `transactions.category_id`, household-scoped to `categories`, alongside the existing `subcategory_id`.
- A manual transaction must have exactly one assignment: a normal active matching-kind subcategory, or the matching protected Other category. Statement imports may still have neither.
- Database validation rejects cross-household, archived, kind-mismatched, non-Other direct categories, dual assignments, and service periods on direct Other transactions.
- Category, subcategory, and transaction read models carry the direct category assignment. Parent reports include direct Other amounts; Bills & Groceries continues to use only its subcategories.

## UI

- `/categories` shows two plain protected rows named `Other`, one in each kind; neither has a disclosure nor an Add subcategory control.
- The transaction category picker adds one grey `Other` option for the active kind. Selecting it writes the direct category ID; selecting any other option writes a subcategory ID.
- Ledger, recent activity, and reports label those rows `Other`, never `Other income`, `Other expenses`, or `Category → Subcategory`.
- Existing category and subcategory flows remain unchanged. No new user-configurable category mode is introduced.

## Verification

- Add focused action and UI tests first for each assignment path and label.
- Add pgTAP coverage for seeding, protected identity, direct-Other-only validation, household/kind isolation, assignment exclusivity, and import compatibility.
- Regenerate database types after the migration, then run focused tests, lint, typecheck, and browser proof for both transaction kinds and `/categories`.

## Non-goals

- No direct assignment for user-created categories.
- No migration of uncategorized imports or historical deleted-category transactions into Other.
- No change to the established child color-family model, Bills requirements, Groceries taxonomy, or shared-balance formula.
