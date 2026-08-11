import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, Settings2 } from "lucide-react";

import { DashboardActionsLoading, DashboardCardLoading } from "./dashboard-loading";
import { DashboardMonthlyTrend, type DashboardMonthlyTrendRow } from "@/components/dashboard-monthly-trend";
import { DashboardSpendingCategorySelector } from "@/components/dashboard-spending-category-selector";
import { DashboardSpendingDonut } from "@/components/dashboard-spending-donut";
import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspacePage } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  getDashboardCategoryChanges,
  getDashboardBalance,
  getDashboardControls,
  getDashboardMonthlyReview,
  getDashboardSpending,
  getDashboardSummary,
} from "@/lib/dashboard-read-model";
import { getValidDateRange, previousMonth, previousThreeDateRanges, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
type DashboardReadOptions = Parameters<typeof getDashboardSummary>[0];

function comparisonLabel(change: number | null, range?: DateRange) {
  if (change === null) return range ? "No previous equivalent range history" : "No previous 3-month history";
  const roundedChange = Math.round(Math.abs(change));
  const baseline = range ? "previous 3 equivalent ranges" : "previous 3-month average";
  if (roundedChange === 0) return `In line with ${baseline}`;
  return `${roundedChange}% ${change > 0 ? "above" : "below"} ${baseline}`;
}

function percentageChange(value: number, average: number | null) {
  return average === null || average === 0 ? null : ((value - average) / average) * 100;
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

export async function DashboardMetricCards({
  options,
  review,
}: {
  options: DashboardReadOptions;
  review: Promise<DashboardMonthlyTrendRow[]>;
}) {
  let metrics: Array<{ change: number | null; kind: "balance" | "expenses" | "income"; title: string; value: number }>;

  if (options.range) {
    const previousRanges = previousThreeDateRanges(options.range);
    const [summary, balance, ...previousBalances] = await Promise.all([
      getDashboardSummary(options),
      getDashboardBalance(options),
      ...previousRanges.map((range) => getDashboardBalance({ ...options, range })),
    ]);
    const averageBalance = previousBalances.reduce((total, value) => total + value.sharedBalance, 0) / previousBalances.length;
    metrics = [
      { title: "Income", kind: "income", value: summary.income, change: summary.incomeChangePercentage },
      { title: "Outgoings", kind: "expenses", value: summary.expenses, change: summary.expenseChangePercentage },
      {
        title: "Shared balance",
        kind: "balance",
        value: balance.sharedBalance,
        change: percentageChange(balance.sharedBalance, averageBalance),
      },
    ];
  } else {
    const months = await review;
    const current = months.at(-1);
    if (!current) throw new Error("Unable to load dashboard review.");
    const previous = months.slice(-4, -1);
    const average = (key: "expenses" | "income" | "sharedBalance") =>
      previous.length ? previous.reduce((total, value) => total + value[key], 0) / previous.length : null;
    metrics = [
      { title: "Income", kind: "income", value: current.income, change: percentageChange(current.income, average("income")) },
      { title: "Outgoings", kind: "expenses", value: current.expenses, change: percentageChange(current.expenses, average("expenses")) },
      {
        title: "Shared balance",
        kind: "balance",
        value: current.sharedBalance,
        change: percentageChange(current.sharedBalance, average("sharedBalance")),
      },
    ];
  }

  return (
    <>
      {metrics.map((metric) => {
        const favorable = metric.change === null || (metric.kind === "expenses" ? metric.change <= 0 : metric.change >= 0);
        return (
          <Card key={metric.kind} className="h-full border-white/50 bg-card/90 lg:col-span-4">
            <CardHeader>
              <CardTitle>{metric.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "font-mono text-3xl font-semibold tabular-nums",
                  metric.kind === "income" || (metric.kind === "balance" && metric.value >= 0)
                    ? "text-positive"
                    : metric.kind === "expenses" || metric.value < 0
                      ? "text-negative"
                      : undefined,
                )}
              >
                {currency.format(metric.value)}
              </p>
              <p
                className={cn(
                  "mt-4 flex items-center gap-2 text-sm",
                  metric.change === null ? "text-muted-foreground" : favorable ? "text-positive" : "text-negative",
                )}
              >
                {metric.change === null ? null : metric.change < 0 ? (
                  <ArrowDownRight aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                )}
                <span className="min-w-0">{comparisonLabel(metric.change, options.range)}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </>
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
    <Card className="border-white/50 bg-card/90 lg:col-span-5 lg:aspect-square">
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

export async function DashboardTrendCard({ review }: { review: Promise<DashboardMonthlyTrendRow[]> }) {
  return <DashboardMonthlyTrend data={await review} />;
}

export async function CategoryChangesCard({ month }: { month: string }) {
  const changes = await getDashboardCategoryChanges(month);
  return (
    <Card className="h-full border-white/50 bg-card/90 lg:col-span-7">
      <CardHeader>
        <CardTitle>Largest changes</CardTitle>
        <CardDescription>Monthly totals vs 3-month average.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {changes.length ? (
            changes.map((change) => (
              <div key={`${change.kind}-${change.categoryName}`} className="flex items-center justify-between gap-4 py-3">
                <span>
                  <strong className="block">{change.categoryName}</strong>
                  <span className="text-sm text-muted-foreground">{currency.format(change.amount)} this month</span>
                </span>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    (change.kind === "expense" && change.changeAmount > 0) || (change.kind === "income" && change.changeAmount < 0)
                      ? "text-negative"
                      : "text-positive",
                  )}
                >
                  {change.changeAmount > 0 ? "+" : "-"}
                  {currency.format(Math.abs(change.changeAmount))}
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No category changes above 20% and ₪250.</p>
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
  const reviewMonth = range?.to.slice(0, 7) ?? month;
  const review = getDashboardMonthlyReview(reviewMonth);
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
        <Suspense
          fallback={
            <>
              <DashboardCardLoading className="h-full lg:col-span-4" title="Income" />
              <DashboardCardLoading className="h-full lg:col-span-4" title="Outgoings" />
              <DashboardCardLoading className="h-full lg:col-span-4" title="Shared balance" />
            </>
          }
        >
          <DashboardMetricCards options={options} review={review} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-5 lg:aspect-square" title="Where your money went" />}>
          <SpendingCard options={options} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="h-full lg:col-span-7" title="Largest changes" />}>
          <CategoryChangesCard month={reviewMonth} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="min-h-80 lg:col-span-12" title="Six-month trend" />}>
          <DashboardTrendCard review={review} />
        </Suspense>
      </section>
    </WorkspacePage>
  );
}
