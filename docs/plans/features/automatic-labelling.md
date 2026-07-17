# Automatic Labelling — Roadmap Brief

## Purpose

Offer optional category suggestions for manual transactions or supported CSV-digest rows, reducing repetitive typing without allowing an AI provider to make financial decisions or silently mutate household data.

## Product shape

- A user can request a suggested category from a transaction note/merchant text and amount context, then explicitly accept, change, or dismiss it.
- Suggestions display the proposed category and a short confidence/explanation label such as “based on merchant wording”; low-confidence results are presented as “No suggestion”.
- The user always sees the final category selector. No model response may create, edit, archive, or delete transactions, categories, budgets, bills, or recurrences.
- Begin with manual transaction composer suggestions. CSV-digest enrichment can be considered later, but stays read-only and must not create labels in the ledger.

## Provider and privacy boundary

- Support OpenAI API and Gemini API behind one server-only provider adapter; provider selection is an environment/configuration decision, not a browser control.
- Never expose provider keys to the browser or commit them. The browser sends the minimum required user-entered text to an authenticated Server Action; the server invokes the configured provider.
- Send only the minimum necessary context: merchant/note text, transaction kind, and the household's active category names. Do not send balances, account identifiers, authorization data, raw CSV files, or other household history by default.
- Before first use, explain that text is sent to the selected external provider and require an explicit household/user consent decision. Provide a way to turn suggestions off.
- Do not use submitted data to train a local model or retain prompts/responses beyond short operational logs unless a later privacy decision explicitly permits it.

## Technical direction

- Define a provider-neutral interface returning a strictly validated category ID or `null`, confidence band, and safe display rationale. Validate every model result against the current household's active expense/income categories.
- Keep provider SDKs and environment reads in server-only modules. Apply authentication, membership lookup, rate limits, request-size limits, timeouts, retry rules that avoid duplicate side effects, and structured redacted observability.
- Treat model output as untrusted input: use schema-constrained JSON where supported, parse defensively, ignore unknown categories, and fail closed to “No suggestion”.
- Unit-test the mapping and validation layer with fake adapters; integration-test each provider only with opt-in credentials and never in the normal test suite.

## Validation and acceptance

- Test consent/off states, category isolation, malformed/model-injected output, provider timeout/error, rate limiting, and no suggestion when confidence is insufficient.
- Test that accepting a suggestion still follows the normal transaction Server Action and that no provider call can mutate persistent data.
- Review provider terms, regional/privacy requirements, costs, and data-retention controls before enabling either provider for real users.

## Dependencies and rollout

Requires live authenticated categories and transaction entry. Build the provider-neutral contract and fake-adapter tests before choosing a production provider; OpenAI and Gemini should remain interchangeable implementations rather than separate product flows.
