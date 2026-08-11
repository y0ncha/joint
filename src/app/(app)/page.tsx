import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Settings2 } from "lucide-react";

import { DashboardActionsLoading, DashboardCardLoading } from "./dashboard-loading";
import { DashboardSpendingCategorySelector } from "@/components/dashboard-spending-category-selector";
import { DashboardSpendingDonut } from "@/components/dashboard-spending-donut";
import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspacePage } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  getDashboardBalance,
  getDashboardControls,
  getDashboardRecentActivity,
  getDashboardSpending,
  getDashboardSummary,
} from "@/lib/dashboard-read-model";
import { getValidDateRange, previousMonth, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
type DashboardReadOptions = Parameters<typeof getDashboardSummary>[0];
type DashboardSummaryPromise = ReturnType<typeof getDashboardSummary>;

function comparisonLabel(change: number | null, range?: DateRange) {
  if (change === null) return range ? "No prior range average" : "No prior average";
  const roundedChange = Math.round(Math.abs(change));
  const baseline = range ? "prior range average" : "prior 3-month average";
  if (roundedChange === 0) return `In line with ${baseline}`;
  return `${roundedChange}% ${change > 0 ? "above" : "below"} ${baseline}`;
}

function donutSegmentPath(startAngle: number, endAngle: number) {
  const point = (radius: number, angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return [100 + radius * Math.cos(radians), 100 + radius * Math.sin(radians)];
  };
  const [outerStartX, outerStartY] = point(96, startAngle);
  const [outerEndX, outerEndY] = point(96, endAngle);
  const [innerEndX, innerEndY] = point(62, endAngle);
  const [innerStartX, innerStartY] = point(62, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A 96 96 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A 62 62 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}

export async function DashboardActions({ month, range }: { month: string; range?: DateRange }) {
  const data = await getDashboardControls();
  const transactionSubcategories = data.subcategories.filter(
    (subcategory) => subcategory.archivedAt === null && subcategory.categoryArchivedAt === null,
  );

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Dashboard controls">
            <Settings2 aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="border-border bg-card/95 p-0 shadow-lg md:max-w-lg">
          <SheetHeader className="p-6">
            <SheetTitle className="text-xl">Dashboard controls</SheetTitle>
            <SheetDescription>Choose the reporting period.</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            <LedgerMonthSelector month={month} range={range} />
          </div>
        </SheetContent>
      </Sheet>
      <TransactionSheet
        directCategories={data.directCategories}
        subcategories={transactionSubcategories}
        currentUserId={data.currentUserId}
        members={data.members}
      />
    </>
  );
}

export async function IncomeCard({ range, summary }: { range?: DateRange; summary: DashboardSummaryPromise }) {
  const report = await summary;

  return (
    <Card className="border-white/50 bg-card/90 lg:col-span-6">
      <CardContent className="p-5">
        <p className="text-base font-semibold text-foreground">Income</p>
        <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.income)}</p>
        <div
          className={cn(
            "mt-5 flex items-center gap-2 text-sm",
            report.incomeChangePercentage === null
              ? "text-muted-foreground"
              : report.incomeChangePercentage >= 0
                ? "text-positive"
                : "text-negative",
          )}
        >
          {report.incomeChangePercentage === null ? (
            range ? (
              "No earlier range history yet. Record income before this range to compare it."
            ) : (
              "No 3-month income history yet. Record income in the prior 3 months to compare this month."
            )
          ) : (
            <>
              {report.incomeChangePercentage < 0 ? (
                <ArrowDownRight aria-hidden="true" className="size-4" />
              ) : (
                <ArrowUpRight aria-hidden="true" className="size-4" />
              )}
              {comparisonLabel(report.incomeChangePercentage, range)}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export async function OutgoingsCard({ range, summary }: { range?: DateRange; summary: DashboardSummaryPromise }) {
  const report = await summary;

  return (
    <Card className="border-white/50 bg-card/90 lg:col-span-6">
      <CardContent className="p-5">
        <p className="text-base font-semibold text-foreground">Outgoings</p>
        <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(report.expenses)}</p>
        <div
          className={cn(
            "mt-5 flex items-center gap-2 text-sm",
            report.expenseChangePercentage === null
              ? "text-muted-foreground"
              : report.expenseChangePercentage > 0
                ? "text-negative"
                : "text-positive",
          )}
        >
          {report.expenseChangePercentage !== null && report.expenseChangePercentage <= 0 ? (
            <ArrowDownRight aria-hidden="true" className="size-4" />
          ) : (
            <ArrowUpRight aria-hidden="true" className="size-4" />
          )}
          {comparisonLabel(report.expenseChangePercentage, range)}
        </div>
      </CardContent>
    </Card>
  );
}

export async function SpendingCard({ options }: { options: DashboardReadOptions }) {
  const [report, controls] = await Promise.all([getDashboardSpending(options), getDashboardControls()]);
  const selectableCategories = controls.categories.filter(
    (category) =>
      category.kind === "expense" &&
      category.archivedAt === null &&
      controls.subcategories.some(
        (subcategory) =>
          subcategory.categoryId === category.id && subcategory.archivedAt === null && subcategory.categoryArchivedAt === null,
      ),
  );
  const selectedCategories = selectableCategories.filter((category) => options.spendingCategoryIds?.includes(category.id));
  const categoriesForSubcategories = selectedCategories.length ? selectedCategories : selectableCategories;
  const fanouts =
    options.spendingGranularity === "subcategories"
      ? await Promise.all(
          categoriesForSubcategories.map(async (category) => ({
            category,
            totals: (await getDashboardSpending({ ...options, spendingCategoryId: category.id })).categoryTotals,
          })),
        )
      : [];
  const parentTotals = selectedCategories.length
    ? report.categoryTotals.filter((category) => selectedCategories.some((selected) => selected.id === category.categoryId))
    : report.categoryTotals;
  const displayedTotals = options.spendingGranularity === "subcategories" ? fanouts.flatMap((fanout) => fanout.totals) : parentTotals;
  const total = displayedTotals.reduce((sum, category) => sum + category.amount, 0);
  const segments = displayedTotals.reduce<Array<{ category: (typeof displayedTotals)[number]; start: number; end: number }>>(
    (values, category) => {
      const start = values.at(-1)?.end ?? 0;
      return [...values, { category, start, end: start + (category.amount / total) * 360 }];
    },
    [],
  );

  return (
    <Card className="border-white/50 bg-card/90 lg:col-span-6 lg:aspect-square">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Where your money went</p>
          </div>
          <DashboardSpendingCategorySelector
            categories={selectableCategories}
            month={options.month}
            range={options.range}
            selectedCategoryIds={selectedCategories.map((category) => category.id)}
            granularity={options.spendingGranularity}
          />
        </div>
        <div className="mt-7 flex justify-center">
          {displayedTotals.length ? (
            <>
              <DashboardSpendingDonut
                ariaLabel={`Spending breakdown: ${displayedTotals.map((category) => `${category.categoryName} ${currency.format(category.amount)}`).join(", ")}`}
                segments={segments.map(({ category, start, end }, index) => ({
                  id: category.categoryId,
                  label: `${category.categoryName}: ${currency.format(category.amount)}`,
                  path: donutSegmentPath(start, end),
                  color: `var(--chart-${(index % 5) + 1})`,
                }))}
                total={currency.format(total)}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No selected category expenses this month.</p>
          )}
        </div>
        {displayedTotals.length ? (
          <p className="sr-only">
            Category spending:{" "}
            {displayedTotals.map((category) => `${category.categoryName} ${currency.format(category.amount)}`).join(", ")}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export async function BalanceCard({ options, range }: { options: DashboardReadOptions; range?: DateRange }) {
  const report = await getDashboardBalance(options);
  const expectedMonthlyIncome = report.expectedMonthlyIncome;

  return (
    <Card className="border-white/50 bg-card/90 lg:col-span-6">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{range ? "Balance at range end" : "Monthly balance"}</p>
          </div>
        </div>
        {expectedMonthlyIncome === null ? (
          <div className="mt-7">
            <p className="font-mono text-2xl font-semibold">No available income</p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {range
                ? "Record income before this range to estimate this balance."
                : "Record income in the last 3 months to estimate this balance."}
            </p>
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
            <p className="text-sm leading-6 text-muted-foreground">
              {range ? "Based on prior range average." : "Based on 3-month income average."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export async function RecentActivityCard({ options }: { options: DashboardReadOptions }) {
  const report = await getDashboardRecentActivity(options);

  return (
    <Card className="mt-4 border-white/50 bg-card/90">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Latest activity</p>
          </div>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link href="/transactions">View all</Link>
          </Button>
        </div>
        <div className="mt-5 divide-y divide-border/80">
          {report.transactions.length ? (
            report.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{transaction.merchant || transaction.note || transaction.kind}</p>
                  <p className="text-sm text-muted-foreground">
                    {transaction.categoryName && transaction.subcategoryName
                      ? `${transaction.categoryName} → ${transaction.subcategoryName}`
                      : (transaction.subcategoryName ?? transaction.categoryName ?? "Uncategorized")}{" "}
                    - {transaction.occurredOn}
                    {transaction.source === "statement_import" ? " - Imported" : ""}
                  </p>
                </div>
                <p className={cn("font-mono text-sm font-semibold", transaction.kind === "income" ? "text-positive" : "text-negative")}>
                  {transaction.kind === "income" ? "+" : "-"}
                  {currency.format(transaction.amount)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No transactions this month.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; month?: string; spendingCategories?: string; spendingGranularity?: string; to?: string }>;
}) {
  const { from, month: requestedMonth, spendingCategories, spendingGranularity: requestedSpendingGranularity, to } = await searchParams;
  const current = previousMonth();
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : current;
  const range = getValidDateRange(from, to);
  const spendingCategoryIds = [
    ...new Set((spendingCategories ?? "").split(",").filter((id) => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id))),
  ];
  const spendingGranularity = requestedSpendingGranularity === "subcategories" ? "subcategories" : "categories";
  const options: DashboardReadOptions = {
    month,
    ...(range ? { range } : {}),
    ...(spendingCategoryIds.length ? { spendingCategoryIds } : {}),
    ...(spendingGranularity === "subcategories" ? { spendingGranularity } : {}),
  };
  const summary = getDashboardSummary(options);

  return (
    <WorkspacePage
      title="Shared money"
      description="A calm view of your household money."
      actions={
        <Suspense fallback={<DashboardActionsLoading />}>
          <DashboardActions month={month} range={range} />
        </Suspense>
      }
    >
      <section className="mt-6 grid gap-4 lg:grid-cols-12">
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-6" title="Income" />}>
          <IncomeCard range={range} summary={summary} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-6" title="Outgoings" />}>
          <OutgoingsCard range={range} summary={summary} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-6 lg:aspect-square" title="Where your money went" />}>
          <SpendingCard options={options} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-6" title={range ? "Balance at range end" : "Monthly balance"} />}>
          <BalanceCard options={options} range={range} />
        </Suspense>
      </section>
      <Suspense fallback={<DashboardCardLoading className="mt-4" title="Latest activity" />}>
        <RecentActivityCard options={options} />
      </Suspense>
    </WorkspacePage>
  );
}
