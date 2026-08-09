# Financial Model

## Purpose

Joint has one signed shared balance per household. This record defines the implemented data model, accounting invariants, reporting behavior, and the migration that established it.

## Ownership and authorization

```text
household
  ├─ household_members
  ├─ categories
  │   └─ subcategories
  ├─ automation_rules
  └─ transactions
```

`household_members` is the household-data authorization boundary. RLS is enabled on household-owned records; application mutations derive the household and user from verified server-side identity rather than browser input.

## Data model and invariants

| Record              | Implemented purpose                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `households`        | Shared container with a signed `opening_balance` and optional shared Groceries monthly threshold.                                                                                                                                         |
| `household_members` | Household membership and `owner` or `member` role.                                                                                                                                                                                        |
| `categories`        | Household-owned `income` or `expense` parent categories with a registered family color and icon.                                                                                                                                          |
| `subcategories`     | Household-owned children with a persisted color from the parent category's database family palette and an optional icon override.                                                                                                         |
| `member_cards`      | Optional household-scoped mapping of a member to one card's last four digits.                                                                                                                                                             |
| `automation_rules`  | Household-owned, enabled or disabled normalization, category-assignment, and preview-confirmed deletion rules with one persisted order; each rule may use validated Merchant, Note, and Amount conditions with per-row AND/OR connectors. |
| `transactions`      | Positive ILS amount, date, `income` or `expense` direction, creator, optional payer and `subcategory_id`, source, merchant, optional note, and optional Bills service period.                                                             |

- The opening balance may be positive, zero, or negative.
- Transaction amounts are positive ILS values with at most two decimal places; direction comes only from `kind`.
- New manual transactions require a matching subcategory from the same household and kind. Statement imports may be uncategorized. Deleting a category deletes its subcategories and clears linked transaction subcategory references, preserving those transactions as uncategorized history.
- A subcategory has no kind of its own; its kind is derived from its parent category.
- Categories use registered family colors. Each subcategory persists one color from its parent's database family palette. A subcategory icon overrides its parent icon; otherwise read models use the parent icon.
- A non-null `paid_by` must identify a member of the same household. Imported transactions may be unassigned when their card has no household mapping.
- Imported transactions retain their `statement_import` source, merchant, SHA-256 file hash, and source-row number. The hash and row number prevent retrying identical source bytes from duplicating rows within a household; source files are not stored.
- Browser input never selects household ownership, transaction creator, or membership role.

## Balance and reporting

```text
shared balance = opening balance + income - expenses
```

For a selected `YYYY-MM` month, the shared balance includes transactions before the first day of the next month. Income, expense, and expense-category totals include all selected-month transactions for past months; for the current month, they stop at `asOfDate` (today by default). Current-month comparisons use activity through that same day-of-month against the prior three months. Expected monthly income averages prior lookback months that contain income. Recent activity sorts by `occurred_on`, then `created_at`, descending.

`src/lib/dashboard-data.ts` loads the household opening balance, categories, subcategories, transactions, and members. It projects each child with its parent category and resolves the effective icon as the child's override or the parent icon. Ledger category filtering remains parent-scoped by mapping each assigned transaction's subcategory to its parent category ID. `src/lib/financial-report.ts` applies the formula as the pure reporting layer and likewise rolls assigned expense totals up through `transactions.subcategory_id` to the parent category. Assigned transaction labels resolve as `Category → Subcategory`.

Uncategorized statement imports and historical transactions orphaned by category or subcategory deletion remain valid and are included in shared-balance, income, expense, comparison, and recent-activity calculations, but omitted from parent-category totals. They render as `Uncategorized`. RLS permits an already-orphaned manual row to remain uncategorized during an update, while still rejecting uncategorized manual inserts and clearing an assigned manual destination. `src/app/actions/transactions.ts` persists manual edits after server-side membership, payer, and active matching-kind subcategory checks; `src/app/actions/statement-import.ts` performs authenticated, atomic statement imports.

## Merchant automation

Merchant automation has three atomic actions: `normalize_merchant` stores one literal replacement, `assign_category` stores exactly one destination, and `delete_transaction` marks matching existing transactions for deletion only through preview and explicit confirmation. A destination is either an active subcategory (including Bills) or the active direct `Other` category for its transaction kind. Bills assignments set the billing period to the full calendar month containing the transaction date. Database constraints, validation triggers, and destination-protection triggers reject malformed rules, cross-household destinations, and archiving destinations while a rule references them.

`src/lib/automation-conditions.ts` owns structured-condition parsing, RE2 validation, legacy decoding, connector-slot transitions, descriptions, compatibility patterns, and left-to-right evaluation. `src/lib/merchant-automations.ts` evaluates every enabled rule against the original trimmed merchant plus the transaction note and positive ILS amount. Merchant and Note condition rows use case-insensitive literal text operators or validated RE2 patterns; Amount uses cents-safe numeric comparisons. Every row after the first has an AND/OR connector and evaluation folds left to right. Reordering moves conditions while retaining the pre-move connector sequence by position. Legacy groups with one group-level connector and legacy rows without `conditions` remain supported. Persisted `position`, then creation time and ID, determine order; the first match for each action wins. Normalization and assignment are independent rather than a sequential pipeline. Normalization writes the trimmed literal replacement. Assignment runs only when the input has no explicit category or subcategory and only when the destination kind matches the transaction kind. Later matches are reported as conflicts but do not alter the result.

New manual transactions and statement-import rows load the household's rules server-side and evaluate them once before the existing insert. An explicit manual destination remains authoritative; an unmatched blank manual destination retains the existing validation error. Normalization and assignment affect those new rows; delete rules are preview-only and are ignored during intake. Statement imports preserve their atomic batch and duplicate-import metadata. Rule loading or evaluation failure stops the new mutation. Transaction edits never run automations.

Existing transactions change or delete only through the `/automations` review dialog and explicit confirmation flow. The preview exact-count reads all transaction pages, reports only changed rows and conflicts, and fingerprints the expected before-and-after payload plus a deterministic snapshot of every effective rule field. The authenticated Server Action reloads and validates that canonical preview and fingerprint before calling `apply_automation_results`; the security-invoker RPC briefly takes a shared rule-table lock, compares the household snapshot, locks the requested household rows, compares each expected timestamp, merchant, and destination, and applies the complete preview batch or none. A stale rule set, transaction, or incomplete preview is rejected. The management page currently loads at most 1,000 rules and suppresses reorder and review when the exact count exceeds the loaded slice.

Household identity is derived from the authenticated server session, never browser input. RLS limits rule CRUD to household members; `anon` and `public` privileges are revoked. The reorder and bulk-apply RPCs use pinned search paths, explicit membership checks, and invoker security. Reordering also takes a household transaction advisory lock and requires every household rule ID exactly once. RE2 provides linear-time matching for user-authored patterns.

## Bills & Groceries subset

Bills & Groceries is an implemented, narrow analytics subset, not a generalized budget or obligations model. Each household has protected `Bills` and `Groceries` expense categories identified by stable system keys. Groceries has exactly the protected `Main run` and `Top-ups` children; Bills may have household-managed children.

Only Bills transactions may have an optional inclusive `service_period_start` and `service_period_end`. Those dates are used solely to prorate the transaction's stored amount for Bills analytics; they never change the ledger row, `occurred_on` posting date, stored amount, or shared-balance calculation. `households.groceries_monthly_budget` is one optional shared monthly Groceries threshold, not a general budget facility. [`bills-groceries-analytics.md`](bills-groceries-analytics.md) records the complete analytics mechanism.

`src/lib/transaction-draft.ts` owns the transaction Sheet's pure kind, destination, posting-date, payer, and Bills service-period transitions plus canonical hidden-field projection. A kind change permanently clears category, subcategory, and service-period state; choosing Bills initializes a same-day period, while every non-Bills destination clears it. Calendar popover visibility remains browser-local component state.

## Shared-balance migration

`20260717210731_align_shared_balance.sql` converted the legacy schema in one transaction. It locks the affected tables, rejects archived accounts, adds `households.opening_balance`, and backfills it from signed legacy opening balances. It deletes no-longer-supported transaction rows, narrows transaction kinds to `income` and `expense`, required a legacy category at that stage, installed category-link validation, and removed obsolete schema. Final checks rejected a missing opening balance or an invalid category relationship before commit.

`20260721183411_add_statement_import.sql` added authenticated CSV/XLSX statement imports, `member_cards`, nullable imported categories and payers, source metadata, and duplicate-import protection. The original manual-entry category invariant remains intact.

`20260725223804_category_subcategory_hierarchy.sql` replaced direct category assignment with household-scoped `subcategories` and `transactions.subcategory_id`. Later grouped-color and icon migrations constrained categories to registered families, persisted each child's database-validated family color, and added optional child icon overrides. `20260726130058_category_deletion_uncategorizes_transactions.sql` made category or subcategory deletion preserve transaction history by setting the linked `subcategory_id` to null.

`20260730125519_essentials_dashboard.sql` added the protected Bills/Groceries taxonomy, optional Bills service-period columns, and the optional shared Groceries monthly threshold. Its constraints keep periods paired, inclusive, ordered, and limited to Bills transactions while preserving stored ledger values and posting dates.

`20260807073928_add_merchant_automation_rules.sql` added household-owned ordered rules, RLS and grants, action and destination validation, destination lifecycle protection, atomic reordering, and stale-safe atomic application of confirmed preview results.

`20260807172644_harden_merchant_automation_confirmation.sql` added locked rule-set snapshot validation and the narrow RLS exception required to normalize manual history already orphaned by a permitted destination deletion.

`20260808064522_add_automation_rule_conditions.sql` adds the optional validated `automation_rules.conditions` JSONB group and includes it in the stale-preview rule snapshot. `20260808070942_fix_automation_rule_conditions_validator.sql` corrects its initial validator safely, and `20260808074420_validate_automation_condition_connectors.sql` accepts per-row connectors while retaining legacy group-level logic. A null group is the backward-compatible legacy merchant-pattern representation; newly created condition rules retain a compatibility `pattern` for older readers while the evaluator uses the structured group.

`20260808084054_add_automation_delete_transaction_action.sql` added the preview-confirmed `delete_transaction` action and extended the stale-safe apply RPC to atomically delete or update matching transactions.

`20260808092908_allow_note_regex_automation_conditions.sql` replaces the validator through a forward migration so the database accepts the same validated `advanced` operator for Merchant and Note while retaining the existing field, length, connector, and amount invariants.

## Primary verification

- `src/lib/financial-report.test.ts`
- `src/lib/dashboard-data.test.ts`
- `src/app/actions/transactions.test.ts`
- `src/lib/merchant-automations.test.ts`
- `src/lib/automation-conditions.test.ts`
- `src/app/actions/merchant-automations.test.ts`
- `src/app/actions/statement-import.test.ts`
- `src/components/automation-rules-workspace.test.tsx`
- `src/components/transaction-ledger.test.tsx`
- `src/app/(app)/page.test.tsx`
- `supabase/tests/shared_balance.sql`
- `supabase/tests/two_layer_access.sql`

## Non-goals

- Merchant rules are the only implemented automatic categorization. There is no general event/action engine, arbitrary action payload, sequential rule pipeline, database-trigger matching, edit-time automation, scheduled recategorization, or configurable service-period inference; Bills assignments use the fixed calendar-month default.
- No double-entry ledger, bank connection, financial credential, attachment, generalized budget, recurring transaction, manually maintained obligation, upcoming/overdue state, expected-versus-recorded analysis, or audit-history model is implemented. CSV/XLSX statement import is supported, but source files and full card details are never stored.
- The directional roadmap does not change these invariants.
