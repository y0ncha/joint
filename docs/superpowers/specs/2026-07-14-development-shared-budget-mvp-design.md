# Development Shared Budget MVP Design

## Goal

Turn the static Joint dashboard into a secure, development/staging-ready shared-household money MVP. Two authenticated members can jointly manage accounts, categories, and manual transactions, then see live monthly totals and balances. This release does not deploy to Vercel or production.

## Scope

### Included

- Google OAuth callback, session-aware routing, sign-out, first-user household creation, and email-delivered invite-link acceptance.
- Authenticated Server Actions for household setup, accounts, categories, and transactions.
- Live dashboard data for a selected month: shared bank balance, monthly income/outgoings, separate card debt, category spending, and recent transactions.
- Transaction entry and editing/deletion: income is bank-only with an income category; expenses use an expense category and a bank or card; transfers are bank-to-card and have no category.
- Account/category editing and category archiving, including clear handling when an archived category has history.
- Database migrations only when the existing schema needs a new capability; regenerated generated database types after every migration.
- Unit tests for validation and balance/reporting rules, plus development-project integration coverage for access isolation and invite acceptance where development credentials permit.

### Excluded

- Vercel deployment, production Supabase configuration, and production data migration.
- Budgets, recurring transactions, imports, labels, attachments, financial credentials, card numbers, statements, or audit-history UI.

## Architecture

Server Components load the signed-in member's household-scoped data through the Supabase SSR server client. Client components are restricted to form state, sheets/dialogs, local accent preference, and navigation interaction. Every persisted write calls an authenticated Server Action that validates its input with Zod and relies on the existing database RLS membership policies.

The OAuth callback exchanges the code for a cookie-backed session. An owner creates an expiring, normalized email invitation in an authenticated Server Action, which sends its URL through a configured server-side email provider and exposes a copy-link fallback when delivery is unavailable. A recipient signs in with Google, and RLS permits only that user to insert their own `member` record when an active invitation matches their signed-in email. A private trigger function consumes the invitation during that insert. Membership, not user-provided metadata or a publicly callable privileged function, remains the authorization boundary.

The dashboard derives all money summaries from the month-filtered transaction set using the existing balance rules. Transfers reduce the selected bank balance and card debt but are excluded from expense totals and category spending. The UI never renders fixture money as if it were persistent data.

## User Experience

The visual language remains the warm gradient canvas with a small number of translucent surfaces and semantic tokens from `src/app/globals.css`. The desktop rail and mobile bottom navigation route to real dashboard, transaction, account, and category areas. The primary “Add transaction” action opens a desktop Sheet or mobile full-screen form. Its segmented kind control changes fields so transfers cannot select a category.

All controls retain keyboard operation, visible focus, labelled icon buttons, and 44px mobile targets. Category reporting presents explicit category names and ILS amounts alongside the visual bars. Empty, loading, validation-error, permission-error, and server-error states use direct copy and never expose implementation details.

## Validation and Error Handling

- Amounts must be finite, positive ILS values.
- Transaction type determines valid account and category combinations; invalid combinations are rejected in the Server Action and surfaced next to the relevant field.
- Household IDs and ownership fields never come from a trusted browser value. The action derives membership from the authenticated session.
- A non-member receives no household data and cannot mutate it under RLS; an invitee can insert only their own member record for an active invitation matching their signed-in email.
- An email delivery failure preserves a safe manual-copy fallback and does not disclose the invitation to another user.
- Missing development environment variables produce a local setup state, not a fake dashboard.

## Testing Seams

- Domain seam: pure validation/reporting functions receive typed transaction/account inputs and return known balance/category results.
- Action seam: authenticated Server Actions accept form input and return a typed success or field-error result while the Supabase client is mocked at its public interface.
- Integration seam: two development-project test users attempt cross-household reads/writes and invite acceptance through the public auth/data interfaces.
- UI seam: server-rendered route output exposes live-state labels, accessible action controls, and truthful empty/setup states.

## Delivery and Publishing

The development Supabase project is the only target. Apply migrations there, inspect the generated types and security advisors, and run the configured test, lint, and production-build commands locally. The code is committed on `feature/shared-budget-mvp`; publishing requires a GitHub remote or explicit authorization to create one. No Vercel command, Git integration release, or production promotion occurs in this work.
