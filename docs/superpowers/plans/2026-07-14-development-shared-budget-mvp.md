# Development Shared Budget MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the authenticated, persistent Joint MVP against the development Supabase project without any Vercel deployment.

**Architecture:** App Router Server Components load only the current user's RLS-scoped household data. Explicit client islands render forms, Sheets, and dialogs; they submit to authenticated Server Actions that validate Zod input and revalidate affected routes. The existing database is extended only to allow secure invite redemption; all finance data remains protected by membership RLS and uses the existing balance invariants.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Bun, shadcn/Radix, Zod, Supabase SSR/Auth/Postgres/RLS, Vitest.

## Global Constraints

- Use Bun; do not add an npm lockfile.
- Do not deploy to Vercel, configure production Supabase, or commit `.env.local`.
- Keep all persistent mutations behind authenticated Server Actions and never expose a Supabase secret/service-role key.
- Use the generated `src/lib/database.types.ts` file and regenerate it after every SQL migration.
- Add only ordered migration files; never rewrite existing migrations.
- RLS applies to all household-owned rows; membership is the authorization boundary.
- Amounts are positive ILS values; income is bank-only, expenses are bank-or-card, and transfers are bank-to-card with no category.
- Transfers reduce bank balance and card debt, and never contribute to category spending or monthly expense totals.
- Follow `docs/design.md`: semantic CSS tokens, English/ILS/DD/MM/YYYY, a labelled textual chart alternative, keyboard access, visible focus, and 44px mobile targets.
- Do not add budgets, recurring items, imports, labels, attachments, financial credentials, card numbers, statements, or audit-history UI.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/<generated>_invite_acceptance_via_rls.sql` | Removes the temporary public RPC and adds RLS/trigger invite acceptance. |
| `src/app/auth/callback/route.ts` | Exchanges OAuth code for the cookie-backed SSR session. |
| `src/app/(app)/layout.tsx` | Requires valid claims and owns authenticated application chrome. |
| `src/app/(app)/page.tsx` | Server-rendered live dashboard with a selected calendar month. |
| `src/app/(app)/accounts/page.tsx`, `categories/page.tsx`, `settings/page.tsx` | Household setup and invite management routes. |
| `src/app/actions/*.ts` | Server-only household, account, category, invite, and transaction mutations. |
| `src/lib/household.ts` | Typed server queries and the selected household lookup. |
| `src/lib/financial-report.ts` | Pure monthly report projection using the established balance rules. |
| `src/lib/validation.ts` | Zod schemas shared by actions and form components. |
| `src/components/transaction-sheet.tsx` | Client transaction create/edit Sheet with kind-driven fields. |
| `src/components/*-form.tsx` | Client setup/invite forms that call Server Actions and render typed field errors. |
| `src/**/*.test.ts(x)` | Domain, action-boundary, and route-markup tests. |

### Task 1: Replace the temporary invite RPC with email-backed RLS acceptance

**Files:**
- Create: `supabase/migrations/<generated>_invite_acceptance_via_rls.sql`
- Modify: `src/lib/database.types.ts`
- Test: `supabase/tests/invitation_acceptance.sql`

**Interfaces:**
- Produces an authenticated `household_members` insert policy for an active, email-matched invitation.
- Produces a non-exposed trigger function that marks that invitation accepted after the allowed insert.

- [ ] **Step 1: Verify the development project and record the temporary migration state**

Run:

```bash
bunx supabase --version
```

Use the authenticated Supabase project connection to list migrations and security advisors. Expected: `joint-development` is active; the temporary RPC migration is present; the only new advisor warning names that public RPC.

- [ ] **Step 2: Create failing RLS tests for an invitee**

```sql
begin;
select plan(2);
-- Seed an owner household and an unaccepted invitation for owner@example.test.
-- Set request.jwt.claim.sub and request.jwt.claim.email to invitee@example.test.
-- With the invitee JWT claims set, insert the invitee's own member record.
-- Assert that the row is denied before the new policy exists.
-- Assert that a different user ID and an expired invitation remain denied.
select * from finish();
rollback;
```

Run the repository-supported SQL test command or an equivalent authenticated transactional SQL session against development. Expected: the matching insert fails before the new policy exists.

- [ ] **Step 3: Generate and apply the corrective RLS/trigger migration**

Run:

```bash
bunx supabase migration new invite_acceptance_via_rls
```

The source migration must be safe both for a fresh database and for the development project that already has the temporary RPC. It drops that function if present, creates the following policies, and keeps the trigger function in `private` with execute revoked from every API role:

```sql
drop function if exists public.accept_household_invitation(uuid);

create policy "Invitees can read their active invitation"
on public.invitations for select to authenticated
using (
  accepted_at is null
  and expires_at > now()
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy "Invitees can join their invited household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and exists (
    select 1 from public.invitations
    where invitations.household_id = household_members.household_id
      and invitations.accepted_at is null
      and invitations.expires_at > now()
      and lower(invitations.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

create function private.consume_matching_invitation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.role = 'member' then
    update public.invitations
    set accepted_at = now()
    where household_id = new.household_id
      and accepted_at is null
      and expires_at > now()
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  end if;
  return new;
end;
$$;
revoke execute on function private.consume_matching_invitation() from public, anon, authenticated;
create trigger household_members_consume_invitation
after insert on public.household_members
for each row execute function private.consume_matching_invitation();
```

- [ ] **Step 4: Regenerate types and make the tests pass**

Run:

```bash
Use the authenticated Supabase project connection to apply the DDL migration, regenerate `src/lib/database.types.ts`, list migrations, and run security advisors.
```

Run the SQL test from Step 2 with matching, wrong, expired, and replayed invitations. Expected: only the matching insert succeeds, it consumes the invitation in the same transaction, and security advisors have no invite-function warning.

- [ ] **Step 5: Commit the schema slice**

```bash
git add supabase/migrations src/lib/database.types.ts supabase/tests/invitation_acceptance.sql
git commit -m "feat: allow authenticated invite acceptance"
```

### Task 2: Complete OAuth callback and authenticated onboarding

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/onboarding/page.tsx`
- Create: `src/app/actions/household.ts`
- Create: `src/lib/household.ts`
- Test: `src/app/auth/callback/route.test.ts`
- Test: `src/app/actions/household.test.ts`

**Interfaces:**
- `getCurrentHousehold(): Promise<{ householdId: string; role: "owner" | "member" } | null>` loads only the member's household.
- `createHousehold(input: FormData): Promise<ActionResult>` creates one owner household for a memberless user.
- `acceptInvitation(input: FormData): Promise<ActionResult>` reads the token through the invitee-only RLS policy, inserts the authenticated user’s membership through the invitee-only RLS policy, and redirects to `/` on success.

- [ ] **Step 1: Write failing callback and onboarding seam tests**

```ts
it("exchanges a valid OAuth code then redirects to onboarding", async () => {
  const response = await GET(new Request("https://joint.test/auth/callback?code=code"));
  expect(response.headers.get("location")).toBe("https://joint.test/onboarding");
});

it("rejects household creation when the member already belongs to one", async () => {
  await expect(createHousehold(formData({ name: "Our home" }))).resolves.toEqual({
    status: "error", formError: "You already belong to a household.", fieldErrors: {},
  });
});
```

Run: `bun run test -- src/app/auth/callback/route.test.ts src/app/actions/household.test.ts`.
Expected: failure because no callback/action exists.

- [ ] **Step 2: Implement SSR-safe session and onboarding flow**

```ts
export async function getCurrentHousehold() {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", claims.claims.sub)
    .maybeSingle();
  if (error) throw error;
  return data ? { householdId: data.household_id, role: data.role } : null;
}
```

The callback exchanges `code` through the server client, rejects an untrusted `next` URL, and routes signed-in members to `/` or `/onboarding`. The action obtains the verified user identity with `getClaims()`, never trusts a browser user ID, inserts `households { name, created_by }`, and redirects only after RLS has created the owner membership.

- [ ] **Step 3: Run the focused tests and manual sign-in check**

Run: `bun run test -- src/app/auth/callback/route.test.ts src/app/actions/household.test.ts`.

Start `bun run dev`, authenticate with the development Google OAuth client, and confirm the first user sees onboarding rather than fixture money. Expected: all focused tests pass and the browser receives a cookie-backed session.

- [ ] **Step 4: Commit the auth slice**

```bash
git add src/app/auth src/app/'(app)' src/app/actions/household.ts src/lib/household.ts
git commit -m "feat: add household onboarding after OAuth"
```

### Task 3: Define the financial report and action validation seams

**Files:**
- Create: `src/lib/financial-report.ts`
- Create: `src/lib/financial-report.test.ts`
- Create: `src/lib/validation.ts`
- Create: `src/lib/validation.test.ts`
- Modify: `src/lib/account-balances.ts`
- Modify: `src/lib/account-balances.test.ts`

**Interfaces:**
- `buildMonthlyReport(accounts, transactions, categories): MonthlyReport` returns bank balance, card debt, income, expenses, category totals, and ordered recent activity.
- `transactionSchema` parses `kind`, positive `amount`, `occurredOn`, `accountId`, optional destination, and optional category into a discriminated union.

- [ ] **Step 1: Write failing behavior tests from the worked financial example**

```ts
it("keeps a 300 ILS bank-to-card transfer out of July expense and category totals", () => {
  expect(buildMonthlyReport(accounts, transactions, categories)).toMatchObject({
    income: 500,
    expenses: 370,
    bankBalance: 1080,
    cardDebt: 350,
    categoryTotals: [{ categoryId: "food", amount: 370 }],
  });
});

it("rejects income on a card and transfers with a category", () => {
  expect(() => transactionSchema.parse(cardIncome)).toThrow();
  expect(() => transactionSchema.parse(categorizedTransfer)).toThrow();
});
```

Run: `bun run test -- src/lib/financial-report.test.ts src/lib/validation.test.ts`.
Expected: failure because the report and schemas are absent.

- [ ] **Step 2: Implement the pure contracts**

```ts
export type MonthlyReport = {
  bankBalance: number;
  cardDebt: number;
  income: number;
  expenses: number;
  categoryTotals: Array<{ categoryId: string; categoryName: string; amount: number }>;
  recentTransactions: Array<{ id: string; kind: "income" | "expense" | "transfer"; amount: number; occurredOn: string; note: string }>;
};

export const transactionSchema = z.discriminatedUnion("kind", [incomeSchema, expenseSchema, transferSchema]);
```

Use explicit numeric conversion for Supabase rows and retain the established `calculateHouseholdBalances` errors for unknown links and invalid bank/card directions.

- [ ] **Step 3: Run domain tests**

Run: `bun run test -- src/lib/account-balances.test.ts src/lib/financial-report.test.ts src/lib/validation.test.ts`.
Expected: all cases pass, including positive amount validation and transfer exclusion.

- [ ] **Step 4: Commit the domain slice**

```bash
git add src/lib/account-balances.ts src/lib/account-balances.test.ts src/lib/financial-report.ts src/lib/financial-report.test.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: add household financial reporting"
```

### Task 4: Add authenticated account, category, invite, and transaction actions

**Files:**
- Create: `src/app/actions/result.ts`
- Create: `src/app/actions/accounts.ts`
- Create: `src/app/actions/categories.ts`
- Create: `src/app/actions/invitations.ts`
- Create: `src/app/actions/transactions.ts`
- Test: `src/app/actions/accounts.test.ts`
- Test: `src/app/actions/categories.test.ts`
- Test: `src/app/actions/invitations.test.ts`
- Test: `src/app/actions/transactions.test.ts`

**Interfaces:**
- `ActionResult = { status: "success" } | { status: "error"; formError?: string; fieldErrors: Record<string, string[]> }`.
- Every action calls `requireCurrentHousehold()` and uses `.eq("household_id", householdId)` for update/delete selectors.

- [ ] **Step 1: Write failing action-boundary tests**

```ts
it("does not accept a household ID supplied by the browser", async () => {
  await createTransaction(formData({ householdId: "other-household", kind: "expense", amount: "50", accountId: "bank", categoryId: "food" }));
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ household_id: "current-household" }));
});

it("returns a category field error for a transfer with a category", async () => {
  expect(await createTransaction(formData({ kind: "transfer", amount: "50", accountId: "bank", destinationAccountId: "card", categoryId: "food" }))).toEqual(
    expect.objectContaining({ status: "error", fieldErrors: { categoryId: expect.any(Array) } }),
  );
});
```

Run: `bun run test -- src/app/actions/accounts.test.ts src/app/actions/categories.test.ts src/app/actions/invitations.test.ts src/app/actions/transactions.test.ts`.
Expected: failure because the actions are absent.

- [ ] **Step 2: Implement the actions using verified claims and typed results**

```ts
"use server";

export async function createTransaction(input: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error);
  const { householdId, userId } = await requireCurrentHousehold();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    created_by: userId,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note,
    account_id: parsed.data.accountId,
    destination_account_id: parsed.data.kind === "transfer" ? parsed.data.destinationAccountId : null,
    category_id: parsed.data.kind === "transfer" ? null : parsed.data.categoryId,
  });
  if (error) return databaseError(error);
  revalidatePath("/");
  return { status: "success" };
}
```

Use the same membership-derived identifiers for account/category/invite mutations. Invitation creation is owner-only through the existing RLS policy and returns a shareable `/invite/<token>` path; it does not imply email delivery.

- [ ] **Step 3: Run focused action tests**

Run: `bun run test -- src/app/actions`.
Expected: all action tests pass and prove user input cannot select another household.

- [ ] **Step 4: Commit the action slice**

```bash
git add src/app/actions src/lib/household.ts
git commit -m "feat: add authenticated household mutations"
```

### Task 5: Build setup, invitation, and navigation routes with owned shadcn components

**Files:**
- Create: `src/app/(app)/accounts/page.tsx`
- Create: `src/app/(app)/categories/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/app/invite/[token]/page.tsx`
- Create: `src/components/account-form.tsx`
- Create: `src/components/category-form.tsx`
- Create: `src/components/invite-form.tsx`
- Create: `src/components/app-navigation.tsx`
- Test: `src/app/(app)/accounts/page.test.tsx`
- Test: `src/app/invite/[token]/page.test.tsx`

**Interfaces:**
- Forms take `{ accounts | categories | householdRole }` server data and invoke Server Actions; their public error seam is `ActionResult`.
- `AppNavigation({ activePath }: { activePath: string })` renders semantic links for dashboard, transactions, accounts, categories, and settings.

- [ ] **Step 1: Write failing markup tests for truthful setup states**

```tsx
it("offers an accessible bank-account setup action when none exist", () => {
  expect(renderPage(<AccountsPage accounts={[]} />)).toContain("Add bank account");
  expect(renderPage(<AccountsPage accounts={[]} />)).toContain("No accounts yet");
});

it("does not reveal an invitation to an anonymous visitor", () => {
  expect(renderPage(<InvitePage invitation={null} />)).toContain("Sign in to accept this invitation");
});
```

Run: `bun run test -- src/app/'(app)'/accounts/page.test.tsx src/app/invite/'[token]'/page.test.tsx`.
Expected: failure because these routes/components do not exist.

- [ ] **Step 2: Implement pages and forms with existing primitives**

Use `Card`, `Button`, `Input`, `Select`, `AlertDialog`, `Sheet`, and `ToggleGroup` already present in `src/components/ui`. `AccountForm` requires name, kind, opening balance, and `DD/MM/YYYY`-displayed opening date. `CategoryForm` offers Income/Expense with `ToggleGroup`, edit, and archive controls. `InviteForm` is owner-only and makes the generated URL copyable with an explicitly labelled button.

- [ ] **Step 3: Run route tests and keyboard smoke checks**

Run: `bun run test -- src/app/'(app)'/accounts/page.test.tsx src/app/invite/'[token]'/page.test.tsx`.

In the browser, tab through each page and confirm all icon-only controls have accessible names and 44px targets. Expected: focused controls are visible and no control requires a pointer.

- [ ] **Step 4: Commit the setup UI slice**

```bash
git add src/app/'(app)' src/app/invite src/components/account-form.tsx src/components/category-form.tsx src/components/invite-form.tsx src/components/app-navigation.tsx
git commit -m "feat: add household setup and invitations"
```

### Task 6: Replace dashboard fixtures with the live monthly dashboard and transaction composer

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/components/dashboard-summary.tsx`
- Create: `src/components/category-spending.tsx`
- Create: `src/components/recent-transactions.tsx`
- Create: `src/components/transaction-sheet.tsx`
- Test: `src/app/(app)/page.test.tsx`
- Test: `src/components/transaction-sheet.test.tsx`

**Interfaces:**
- `getDashboardData(month: string): Promise<DashboardData>` fetches RLS-scoped accounts/categories/transactions and maps them with `buildMonthlyReport`.
- `TransactionSheet({ accounts, categories, transaction }: TransactionSheetProps)` hides category controls for transfers and only exposes bank sources/card destinations when needed.

- [ ] **Step 1: Write failing live-data and form behavior tests**

```tsx
it("renders a setup state instead of fixture currency without a bank account", () => {
  expect(renderPage(<DashboardPage data={emptyDashboard} />)).toContain("Add your shared bank account");
  expect(renderPage(<DashboardPage data={emptyDashboard} />)).not.toContain("18,420");
});

it("removes category input when Transfer is selected", () => {
  render(<TransactionSheet accounts={accounts} categories={categories} transaction={null} />);
  fireEvent.click(screen.getByRole("radio", { name: "Transfer" }));
  expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  expect(screen.getByLabelText("From bank account")).toBeInTheDocument();
});
```

Run: `bun run test -- src/app/'(app)'/page.test.tsx src/components/transaction-sheet.test.tsx`.
Expected: failure while the route is still the static fixture page.

- [ ] **Step 2: Implement the live server route and client composer**

The route reads `searchParams.month` as `YYYY-MM`, defaults to the current month, and obtains all household data through `getDashboardData`. It renders ILS with `Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" })`, dates as `DD/MM/YYYY`, live category amounts plus an accessible table, the separate credit-card debt, and a no-data setup state.

`TransactionSheet` is the only new large client island. Use `ToggleGroup` for Income/Expense/Transfer, submit form data to the appropriate action, preserve fields on validation failure, use `Sheet` on desktop and a full-height mobile panel, and use `AlertDialog` for delete confirmation.

- [ ] **Step 3: Run focused tests and the real development workflow**

Run: `bun run test -- src/app/'(app)'/page.test.tsx src/components/transaction-sheet.test.tsx`.

With a development household containing a bank, card, categories, and one of every transaction kind, add/edit/delete each kind. Expected: balance, card debt, monthly totals, recent activity, and category totals update after every mutation; transfer is absent from expense/category totals.

- [ ] **Step 4: Commit the dashboard slice**

```bash
git add src/app/'(app)'/page.tsx src/components/dashboard-summary.tsx src/components/category-spending.tsx src/components/recent-transactions.tsx src/components/transaction-sheet.tsx
git commit -m "feat: render live household dashboard"
```

### Task 7: Validate RLS isolation and development configuration

**Files:**
- Create: `tests/integration/rls-isolation.test.ts`
- Create: `tests/integration/invite-acceptance.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Integration tests use two ordinary authenticated test users and only the publishable-key data/auth APIs; they do not use a service-role key as the behavior under test is RLS.

- [ ] **Step 1: Write failing RLS integration scenarios**

```ts
it("does not return household A accounts or allow a household A write to a member of household B", async () => {
  const result = await memberB.from("accounts").select().eq("household_id", householdAId);
  expect(result.data).toEqual([]);
  const insert = await memberB.from("transactions").insert(transactionFor(householdAId));
  expect(insert.error).not.toBeNull();
});
```

Run: `bun run test -- tests/integration/rls-isolation.test.ts tests/integration/invite-acceptance.test.ts` with development-only test credentials. Expected: fail before test harness/fixtures are configured.

- [ ] **Step 2: Add an opt-in development integration harness and environment documentation**

Add names only to `.env.example`:

```dotenv
JOINT_INTEGRATION_USER_A_EMAIL=
JOINT_INTEGRATION_USER_A_PASSWORD=
JOINT_INTEGRATION_USER_B_EMAIL=
JOINT_INTEGRATION_USER_B_PASSWORD=
```

The tests must skip with a clear message when these variables are absent, and must clean only records in a unique per-run test household. Update `README.md` with Google OAuth redirect `http://127.0.0.1:3000/auth/callback`, the dev project setup, and the opt-in integration command.

- [ ] **Step 3: Run the integration tests and security checks**

Run:

```bash
bun run test -- tests/integration/rls-isolation.test.ts tests/integration/invite-acceptance.test.ts
bunx supabase db advisors --linked
```

Expected: credentials present → cross-household reads are empty and writes are denied; credentials absent → the integration suite reports intentional skips; advisors show no new critical issue.

- [ ] **Step 4: Commit the verification slice**

```bash
git add tests/integration .env.example README.md
git commit -m "test: verify development household isolation"
```

### Task 8: Full local verification and publish the branch without deploying

**Files:**
- Modify only files identified by fixes from the commands below.

**Interfaces:**
- No Vercel deployment interface is used in this task.

- [ ] **Step 1: Review all changed TSX files against project React and shadcn rules**

Check that each interactive component is a client component only where needed, all lists have stable IDs, every icon button has an accessible label, forms use owned primitives, and no arbitrary Tailwind colors or nested glass-card pattern was introduced.

- [ ] **Step 2: Run the full automated suite**

Run:

```bash
bun run lint
bun run test
bun run build
```

Expected: each command exits 0. Fix failures with a new red-green test where the failure represents behavior, then rerun the complete command.

- [ ] **Step 3: Perform one browser story against the development project**

Verify: sign in → create household → add bank/card/categories → create income, bank expense, card expense, and transfer → change month → create shareable invite → sign in as matching invitee → confirm both members see the same data → confirm a separate user cannot see it. Capture browser console errors and stop at the first failed boundary.

- [ ] **Step 4: Inspect final scope and publish only after GitHub is connected**

Run:

```bash
rtk git status
rtk diff
git remote -v
```

Stage only Joint source, docs, tests, migrations, and generated types. If no GitHub remote exists, stop and request the repository URL or explicit authorization to create a repository named `joint`; do not guess an owner or publish target. Once connected and the worktree is intentional:

```bash
git add AGENTS.md README.md .env.example components.json docs src supabase tests package.json bun.lock next.config.ts next.config.test.ts postcss.config.mjs eslint.config.mjs tsconfig.json vitest.config.ts .gitignore
git commit -m "feat: complete development shared budget mvp"
git push -u origin feature/shared-budget-mvp
```

Expected: branch push succeeds; no `vercel`, `vercel deploy`, or production promotion command is run.
