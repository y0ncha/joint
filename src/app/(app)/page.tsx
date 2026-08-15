import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Settings2 } from "lucide-react";

import { DashboardActionsLoading, DashboardCardLoading } from "./dashboard-loading";
import { DashboardMonthlyTrend, type DashboardMonthlyTrendRow } from "@/components/dashboard-monthly-trend";
import { DashboardSpendingCategorySelector } from "@/components/dashboard-spending-category-selector";
import { DashboardSpendingDonut } from "@/components/dashboard-spending-donut";
import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { TransactionSheet } from "@/components/transaction-sheet";
import { Button } from "@/components/ui/button";
import { WorkspacePage } from "@/components/workspace-shell";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sortBudgetUrgency } from "@/lib/budgets-goals";
import { getBudgetsGoalsData, type BudgetRow, type GoalRow } from "@/lib/budgets-goals-data";
import { getDashboardControls, getDashboardMonthlyReview, getDashboardSpending, getDashboardSummary } from "@/lib/dashboard-read-model";
import { getValidDateRange, isCanonicalIsoMonth, previousMonth, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const detailCurrency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });
type DashboardReadOptions = Parameters<typeof getDashboardSummary>[0];

function comparisonLabel(change: number | null, range?: DateRange) {
  if (change === null) return range ? "No previous equivalent range history" : "No previous 3-month history";
  const roundedChange = Math.round(Math.abs(change));
  const baseline = range ? "previous 3 equivalent ranges" : "previous 3-month average";
  if (roundedChange === 0) return `In line with ${baseline}`;
  return `${roundedChange}% ${change > 0 ? "above" : "below"} ${baseline}`;
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

export async function DashboardMetricCards({ options }: { options: DashboardReadOptions }) {
  const summary = await getDashboardSummary(options);
  const metrics: Array<{ change: number | null; kind: "balance" | "expenses" | "income"; title: string; value: number }> = [
    { title: "Income", kind: "income", value: summary.income, change: summary.incomeChangePercentage },
    { title: "Outgoings", kind: "expenses", value: summary.expenses, change: summary.expenseChangePercentage },
    {
      title: "Monthly balance",
      kind: "balance",
      value: summary.income - summary.expenses,
      change: summary.balanceChangePercentage,
    },
  ];

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
              <p className="font-mono text-3xl font-semibold tabular-nums">{currency.format(metric.value)}</p>
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
  const displayedTotals = report.categoryTotals;
  const total = displayedTotals.reduce((sum, category) => sum + category.amount, 0);

  return (
    <Card className="border-white/50 bg-card/90 lg:col-span-5 md:aspect-square">
      <CardHeader>
        <CardTitle>Where your money went</CardTitle>
        <CardDescription>Expense categories for this period.</CardDescription>
        <CardAction>
          <DashboardSpendingCategorySelector
            categories={selectableCategories}
            month={options.month}
            range={options.range}
            selectedCategoryIds={selectedCategories.map((category) => category.id)}
            granularity={options.spendingGranularity}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {displayedTotals.length ? (
            <DashboardSpendingDonut
              ariaLabel={`Spending breakdown: ${displayedTotals.map((category) => `${category.categoryName} ${currency.format(category.amount)}`).join(", ")}`}
              segments={displayedTotals.map((category, index) => ({
                id: category.categoryId,
                label: `${category.categoryName}: ${currency.format(category.amount)}`,
                value: category.amount,
                color: `var(--analytics-bill-${(index % 15) + 1})`,
              }))}
              total={currency.format(total)}
            />
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

function DashboardDetailTooltip({ ariaLabel, children }: { ariaLabel: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={ariaLabel} className="size-11" size="icon" type="button" variant="ghost">
          <Info aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="break-words motion-reduce:animate-none" side="left">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function formatBudgetDetail(row: BudgetRow) {
  const spent = detailCurrency.format(row.spent);
  const limit = detailCurrency.format(row.monthlyBudget);
  const level = row.targetKind === "category" ? "Category" : "Subcategory";
  return row.progress.overBudgetAgorot > 0
    ? `${row.label}: ${level}; ${spent} spent of ${limit} budget; ${detailCurrency.format(row.progress.overBudgetAgorot / 100)} over budget`
    : `${row.label}: ${level}; ${spent} spent of ${limit} budget; ${detailCurrency.format(row.progress.remainingAgorot / 100)} remaining`;
}

function formatGoalDetail(row: GoalRow) {
  const saved = detailCurrency.format(row.savedAmount);
  const target = detailCurrency.format(row.targetAmount);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${row.targetDate}T12:00:00`),
  );
  const status = row.progress.status === "complete" ? "Complete" : row.progress.status === "overdue" ? "Overdue" : "Active";
  const monthly =
    row.progress.monthlyRequiredAgorot === null
      ? "no monthly saving available"
      : `save ${detailCurrency.format(row.progress.monthlyRequiredAgorot / 100)} per month`;
  return `${row.label}: ${saved} saved of ${target} target; needed by ${date}; ${status}; ${monthly}; ${detailCurrency.format(row.progress.remainingAgorot / 100)} remaining`;
}

function DashboardBudgetRow({ row }: { row: BudgetRow }) {
  const details = formatBudgetDetail(row);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1">
      <span className="min-w-0 truncate font-medium">{row.label}</span>
      <span className="font-mono text-sm tabular-nums">{Math.round(row.progress.percentage)}%</span>
      <DashboardDetailTooltip ariaLabel={details}>{details}</DashboardDetailTooltip>
      <Progress
        aria-label={`${row.label}: ${Math.round(row.progress.percentage)}% of monthly budget`}
        className="col-span-2 h-2"
        value={row.progress.barPercentage}
      />
    </div>
  );
}

function DashboardGoalRow({ row }: { row: GoalRow }) {
  const status = `${Math.round(row.progress.percentage)}%`;
  const details = formatGoalDetail(row);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1">
      <span className="min-w-0 truncate font-medium">{row.label}</span>
      <span className="font-mono text-sm tabular-nums">{status}</span>
      <DashboardDetailTooltip ariaLabel={details}>{details}</DashboardDetailTooltip>
      <Progress aria-label={`${row.label}: ${status}`} className="col-span-2 h-2" value={row.progress.barPercentage} />
    </div>
  );
}

export async function BudgetsGoalsWidget({ options }: { options: DashboardReadOptions }) {
  const data = await getBudgetsGoalsData(options);
  const budgets = sortBudgetUrgency(data.budgets).slice(0, 2);
  const goal = data.goals.find((candidate) => candidate.progress.status !== "complete");

  return (
    <Card className="h-full border-white/50 bg-card/90 lg:col-span-7">
      <CardHeader>
        <CardTitle>Budgets &amp; Goals</CardTitle>
        <CardAction>
          <Button asChild className="min-h-11 px-0" size="sm" variant="link">
            <Link href="/budgets-goals">Manage</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-4">
        {budgets.length || goal ? (
          <TooltipProvider>
            {budgets.map((row) => (
              <DashboardBudgetRow key={`${row.targetKind}:${row.id}`} row={row} />
            ))}
            {goal ? <DashboardGoalRow row={goal} /> : null}
          </TooltipProvider>
        ) : (
          <p className="text-sm text-muted-foreground">No budgets or goals yet.</p>
        )}
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
  const month = requestedMonth && isCanonicalIsoMonth(requestedMonth) ? requestedMonth : current;
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
              <DashboardCardLoading className="h-full lg:col-span-4" title="Monthly balance" />
            </>
          }
        >
          <DashboardMetricCards options={options} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="lg:col-span-5 md:aspect-square" title="Where your money went" />}>
          <SpendingCard options={options} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="h-full lg:col-span-7" title="Budgets & Goals" />}>
          <BudgetsGoalsWidget options={options} />
        </Suspense>
        <Suspense fallback={<DashboardCardLoading className="min-h-80 lg:col-span-12" title="Six-month trend" />}>
          <DashboardTrendCard review={review} />
        </Suspense>
      </section>
    </WorkspacePage>
  );
}
