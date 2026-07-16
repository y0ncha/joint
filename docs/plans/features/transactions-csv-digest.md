# Transaction CSV Digest — Roadmap Brief

## Purpose

Let a household upload a bank/card CSV that follows a supplied template and receive a useful monthly digest, while keeping Joint's manual ledger as the only source of persisted financial records.

## Product shape

- Provide one downloadable/importable CSV template with required headers, example rows, date and ILS amount formats, and clear scope notes.
- A member uploads a completed template, selects the reporting month when needed, reviews validation errors row by row, and sees a read-only digest.
- The digest can show totals, inflows/outflows, merchant/category-style groupings when supplied by the template, largest movements, and an explicit unmatched/unknown bucket.
- The user can discard the upload at any time. There is no “import transactions” or “save to ledger” action.
- Do not accept arbitrary bank exports in the first version; template compatibility is the product boundary.

## Rules and decisions

- A CSV amount describes external statement activity, not a Joint transaction. It never changes the shared balance, categories, budget progress, bills, or recurring records.
- The page must say that the digest is separate from the manual ledger, so duplicate-looking activity cannot be mistaken for persisted spending.
- Reject malformed headers, unsupported encodings, ambiguous dates, non-ILS values, non-finite amounts, and files/row counts above a documented safe limit.
- Digest results are private to the requesting signed-in household session unless the household deliberately saves a future report feature.

## Technical direction

- Parse and validate on the server through an authenticated Server Action or route handler; never trust client-side parsing for file limits or data validation.
- Define a versioned template contract and a pure parser/report builder with typed rows, deterministic normalisation, and explicit error locations.
- Process uploads in memory or short-lived temporary storage only. Do not persist source CSVs, bank credentials, statement identifiers, or raw transactions in Supabase for the initial feature.
- Keep a strict size, row-count, field-length, and execution-time ceiling. Escape displayed text and generate any download only from validated values.
- Render the result with an accessible table/list alternative to visual summaries and preserve the current English/ILS/date conventions.

## Validation and acceptance

- Test valid template data, each header/error class, empty files, duplicate rows, quoted commas, UTF-8 BOM, oversized input, and locale/date boundaries.
- Test that no upload invokes transaction Server Actions or inserts into `transactions`.
- Browser-test keyboard upload, error focus, discard, loading, and readable small-screen results.

## Dependencies and rollout

The user will supply the template before implementation. Finalise the parser only against that exact contract. This feature can ship after the manual-ledger MVP and does not require budgets, bills, recurring expenses, or AI labelling.

