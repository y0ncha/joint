# Joint — Architecture

## System boundary

Joint is a Next.js App Router application deployed on Vercel. Supabase provides Google OAuth, Postgres, Row Level Security (RLS), and the server-side data layer. The app stores only manual financial records—never bank credentials, card numbers, statements, or imported transactions.

The MVP exposes one shared household balance. The `accounts` table remains in the schema as a future-ready foundation, but the application creates and uses one internal bank account for the shared balance and does not expose account management, credit-card debt, or transfers in the visible MVP.

```text
Browser
  └─ Next.js UI (client islands only for interaction)
       └─ authenticated Server Actions
            └─ Supabase SSR server client
                 └─ Postgres with RLS
```

## Application structure

| Area | Responsibility |
| --- | --- |
| `src/app/` | App Router pages, layout, global tokens, route-level UI. |
| `src/components/` | Product components and owned shadcn primitives. |
| `src/lib/` | Pure domain logic, Supabase clients, database types, utilities. |
| `src/proxy.ts` | Supabase SSR session refresh. |
| `supabase/migrations/` | Ordered, versioned Postgres schema and RLS changes. |
| `docs/` | Product/design/architecture decision records and plans. |
| `.agents/` | Project-local agent instructions and skills. |

## Authentication and authorization

- Authentication: Supabase Auth with Google OAuth.
- Authorization: membership in `household_members` is the sole access boundary for household data.
- The household creator is `owner`; the invited partner is `member`.
- Both roles can create, edit, and delete household transactions, accounts, and categories. Owner-only actions are household settings, membership, and invitations.
- Security-definer helper functions are in the `private` schema and callable only by authenticated users. RLS policies invoke them for household-owned rows.
- Browser code uses only the Supabase publishable key. The service-role key must remain server-only and is not needed for normal app mutations.

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | App profile created for each `auth.users` account. |
| `households` | Shared household container. |
| `household_members` | Household membership and role. |
| `invitations` | Expiring email invitation token. |
| `accounts` | Internal shared-balance account for the MVP; future-ready foundation for multiple bank/card accounts. |
| `categories` | Household-owned income or expense categories; can be archived. |
| `transactions` | Positive amount, date, note, income/expense kind, internal account, category, creator, and paid-by member. |

The initial migration indexes household/date, account/date, and category/date paths. This is deliberate: avoid double-entry accounting or analytics tables until actual usage requires them.

## Balance rules

| Event | Shared balance | Category reporting |
| --- | ---: | --- |
| Income | increases | income category |
| Expense | decreases | expense category |

Transfers, visible card debt, and user-selected accounts are intentionally out of the MVP. `src/lib/account-balances.ts` is the current pure reference implementation. Preserve these invariants in every database query, Server Action, and UI summary.

## Rendering and interaction

- Default to Server Components. Use client components only for browser state or interaction, such as the local Appearance picker.
- Use shadcn/Radix primitives with semantic CSS tokens defined in `src/app/globals.css`.
- Personal visual accents are local to the browser (`joint-accent`), never shared household state.
- The dashboard is a responsive authenticated composition backed by Supabase queries. It reports live household data through the single visible shared-balance model.

## Environments

| Environment | Supabase | Vercel target | Intended use |
| --- | --- | --- | --- |
| Local / preview | Development project in EU Central (Frankfurt) | local dev / Vercel preview | schema and feature work |
| Production | Separate EU Central project, pending setup | Vercel production from `main` | real household data |

Keep `.env.local` private. Maintain `.env.example` with names only. Production configuration requires explicit user action because a second free Supabase project was unavailable at the time of setup.
