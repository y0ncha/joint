import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";

import { DashboardControls } from "@/components/dashboard-controls";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { currentMonth, formatDateRange, getValidDateRange, type DateRange } from "@/lib/date-range";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
function comparisonLabel(change: number | null, range?: DateRange) {
  if (change === null) return range ? "No prior range average" : "No prior average";
  const roundedChange = Math.round(Math.abs(change));
  const baseline = range ? "prior range average" : "prior 3-month average";
  if (roundedChange === 0) return `In line with ${baseline}`;
  return `${roundedChange}% ${change > 0 ? "above" : "below"} ${baseline}`;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ from?: string; month?: string; to?: string }> }) {
  const { from, month: requestedMonth, to } = await searchParams;
  const current = currentMonth();
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : current;
  const range = getValidDateRange(from, to);
  const data = range ? await getDashboardData(month, range) : await getDashboardData(month);
  const { report } = data;
  const activeCategories = data.categories.filter((category) => category.archivedAt === null);
  const transactionCategories = activeCategories.map(({ id, name, kind }) => ({ id, name, kind }));
  const maximumCategoryAmount = Math.max(1, ...report.categoryTotals.map((category) => category.amount));
  const expectedMonthlyIncome = report.expectedMonthlyIncome;
  const categoryName = new Map(data.categories.map((category) => [category.id, category.name]));

  return (
    <WorkspaceShell
      title="Shared money"
      description="A calm view of your household money."
      actions={<><DashboardControls month={month} range={range} /><TransactionSheet categories={transactionCategories} currentUserId={data.currentUserId} members={data.members} /></>}
    >
      <>
          <section className="mt-6 grid gap-4 lg:grid-cols-12">
            <Card className="border-white/50 bg-card/90 lg:col-span-6">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.income)}</p>
                <div className={cn("mt-5 flex items-center gap-2 text-sm", report.incomeChangePercentage === null ? "text-muted-foreground" : report.incomeChangePercentage >= 0 ? "text-positive" : "text-negative")}>
                  {report.incomeChangePercentage === null ? (
                    range ? "No earlier range history yet. Record income before this range to compare it." : "No 3-month income history yet. Record income in the prior 3 months to compare this month."
                  ) : (
                    <>
                      {report.incomeChangePercentage < 0 ? <ArrowDownRight aria-hidden="true" className="size-4" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
                      {comparisonLabel(report.incomeChangePercentage, range)}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-6">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Outgoings</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.expenses)}</p>
                <div className={cn("mt-5 flex items-center gap-2 text-sm", report.expenseChangePercentage === null ? "text-muted-foreground" : report.expenseChangePercentage > 0 ? "text-negative" : "text-positive")}>
                  {report.expenseChangePercentage !== null && report.expenseChangePercentage <= 0 ? <ArrowDownRight aria-hidden="true" className="size-4" /> : <ArrowUpRight aria-hidden="true" className="size-4" />}
                  {comparisonLabel(report.expenseChangePercentage, range)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-8">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Where your money went</p>
                    <h2 className="mt-1 text-lg font-semibold">{range ? formatDateRange(range) : "This month"}</h2>
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
                    <p className="text-sm font-medium text-muted-foreground">{range ? "Balance at range end" : "Monthly balance"}</p>
                  </div>
                </div>
                {expectedMonthlyIncome === null ? (
                  <div className="mt-7">
                    <p className="font-mono text-2xl font-semibold">No available income</p>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{range ? "Record income before this range to estimate this balance." : "Record income in the last 3 months to estimate this balance."}</p>
                  </div>
                ) : (
                  <>
                    <p className={cn("mt-7 font-mono text-3xl font-semibold", report.sharedBalance >= 0 ? "text-positive" : "text-negative")}>
                      {currency.format(report.sharedBalance)}
                    </p>
                    <div className="mt-6 flex flex-col gap-4">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">Expected income</span>
                        <span className="font-mono text-muted-foreground">{currency.format(expectedMonthlyIncome)}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">Outgoings so far</span>
                        <span className="font-mono text-muted-foreground">{currency.format(report.expenses)}</span>
                      </div>
                    </div>
                    <Separator className="my-5" />
                    <p className="text-sm leading-6 text-muted-foreground">{range ? "Based on prior range average." : "Based on 3-month income average."}</p>
                  </>
                )}
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{transaction.merchant || transaction.note || transaction.kind}</p>
                      <p className="text-sm text-muted-foreground">{transaction.categoryId ? categoryName.get(transaction.categoryId) : "Uncategorized"} - {transaction.occurredOn}{transaction.source === "statement_import" ? " - Imported" : ""}</p>
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
    </WorkspaceShell>
  );
}
