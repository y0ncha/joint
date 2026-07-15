import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal, Plus, WalletCards } from "lucide-react";

import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ month?: string }> } = {}) {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims?.sub) {
    redirect("/login");
    return null;
  }

  if (!(await getCurrentHousehold())) {
    redirect("/onboarding");
    return null;
  }

  const requestedMonth = (await searchParams)?.month;
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonth();
  const data = await getDashboardData(month);
  const { report } = data;
  const activeCategories = data.categories.filter((category) => category.archivedAt === null);
  const transactionCategories = activeCategories.map(({ id, name, kind }) => ({ id, name, kind }));
  const maximumCategoryAmount = Math.max(1, ...report.categoryTotals.map((category) => category.amount));
  const maximumFlowAmount = Math.max(1, report.income, report.expenses);
  const accountName = new Map(data.accounts.map((account) => [account.id, account.name]));
  const categoryName = new Map(data.categories.map((category) => [category.id, category.name]));

  return (
    <WorkspaceShell
      title="Shared money"
      description="A calm view of your household money."
      actions={(
        <>
          <div className="hidden sm:block">
            <TransactionSheet categories={transactionCategories} currentUserId={data.currentUserId} members={data.members} />
          </div>
        </>
      )}
    >
      <div className="mt-6 flex items-center justify-between gap-3">
        <Badge variant="secondary" className="rounded-full bg-white/65 px-3 py-1.5 text-sm font-medium text-foreground">{month}</Badge>
        <div className="sm:hidden">
          <TransactionSheet categories={transactionCategories} currentUserId={data.currentUserId} members={data.members} />
        </div>
      </div>

      {data.setupRequired ? (
        <Card className="mt-5 border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Set up your household</CardTitle>
            <CardDescription>Your shared balance was not created. Create a new household from the setup flow to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-xl">
              <Link href="/onboarding">
                <Plus data-icon="inline-start" />
                Open setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="mt-5 grid gap-4 lg:grid-cols-12">
            <Card className="border-white/50 bg-card/90 lg:col-span-6">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Shared balance</p>
                    <p className="mt-3 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">{currency.format(report.bankBalance)}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <WalletCards aria-hidden="true" className="size-5" />
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2 text-sm">
                  <Badge className="rounded-full bg-primary px-3 py-1.5">
                    <ArrowUpRight data-icon="inline-start" />
                    {currency.format(report.income - report.expenses)} this month
                  </Badge>
                  <span className="self-center text-muted-foreground">Available in the shared bank account</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-3">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.income)}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-positive">
                  <ArrowDownRight aria-hidden="true" className="size-4" />
                  Recorded this month
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-3">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Outgoings</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.expenses)}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-negative">
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                  {report.income ? `${Math.round((report.expenses / report.income) * 100)}% of income` : "No income yet"}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-8">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Where your money went</p>
                    <h2 className="mt-1 text-lg font-semibold">This month</h2>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="More chart options">
                    <MoreHorizontal />
                  </Button>
                </div>
                <div className="mt-7 flex flex-col gap-5">
                  {report.categoryTotals.length ? report.categoryTotals.map((category) => (
                    <div key={category.categoryId}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">{category.categoryName}</span>
                        <span className="font-mono text-muted-foreground">{currency.format(category.amount)}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${(category.amount / maximumCategoryAmount) * 100}%` }} />
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No expense categories this month.</p>}
                </div>
                {report.categoryTotals.length ? (
                  <p className="sr-only">
                    Category spending: {report.categoryTotals.map((category) => `${category.categoryName} ${currency.format(category.amount)}`).join(", ")}.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-4">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monthly flow</p>
                    <h2 className="mt-1 text-lg font-semibold">Income vs outgoings</h2>
                  </div>
                </div>
                <div className="mt-7 flex flex-col gap-5">
                  <div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">Income</span>
                      <span className="font-mono text-muted-foreground">{currency.format(report.income)}</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${(report.income / maximumFlowAmount) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium">Outgoings</span>
                      <span className="font-mono text-muted-foreground">{currency.format(report.expenses)}</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-negative" style={{ width: `${(report.expenses / maximumFlowAmount) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <Separator className="my-5" />
                <p className="text-sm leading-6 text-muted-foreground">Net change this month: <span className="font-mono text-foreground">{currency.format(report.income - report.expenses)}</span>.</p>
              </CardContent>
            </Card>
          </section>

          <Card className="mt-4 border-white/50 bg-card/90">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Latest activity</p>
                  <h2 className="mt-1 text-lg font-semibold">Recent transactions</h2>
                </div>
                <Button asChild variant="ghost" className="rounded-xl">
                  <Link href="/transactions">View all</Link>
                </Button>
              </div>
              <div className="mt-5 divide-y divide-border/80">
                {report.recentTransactions.length ? report.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                      {transaction.kind === "income" ? <ArrowDownRight aria-hidden="true" className="size-4" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{transaction.note || transaction.kind}</p>
                      <p className="text-sm text-muted-foreground">{transaction.categoryId ? categoryName.get(transaction.categoryId) : accountName.get(transaction.accountId)} - {transaction.occurredOn}</p>
                    </div>
                    <p className={cn("font-mono text-sm font-semibold", transaction.kind === "income" ? "text-positive" : "text-negative")}>
                      {transaction.kind === "income" ? "+" : "-"}{currency.format(transaction.amount)}
                    </p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No transactions this month.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </WorkspaceShell>
  );
}
