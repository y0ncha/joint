"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, XAxis, YAxis } from "recharts";
import { ArrowLeft, ChevronDown, Maximize2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { alignBillYearOverYear } from "@/lib/analytics";
import type { AnalyticsChartId } from "@/lib/analytics-chart-ids";
import {
  analyticsNavigationKind,
  buildAnalyticsUrl,
  parseAnalyticsPresentationState,
  type AnalyticsUrlUpdates,
  type GroceryPresentationFilter,
} from "@/lib/analytics-navigation";
import { cn } from "@/lib/utils";
import type { getAnalyticsData } from "@/lib/analytics-data";

export { analyticsChartIds, type AnalyticsChartId } from "@/lib/analytics-chart-ids";

type BillKey = string;
type Period = "rolling" | "calendar";
type MonthlyChartDatum = { month: string } & Record<string, string | number>;
type GroceryMonthlyDatum = { month: string; mainRun: number; topUps: number; budget?: number };
type YearOverYearDatum = {
  bike?: number;
  car?: number;
  current: number;
  month: string;
  previous?: number;
  previousBike?: number;
  previousCar?: number;
};

export function groceryTransactionsForDate<Transaction extends { occurredOn: string; subcategoryKey: "main_run" | "top_ups" }>(
  transactions: Transaction[],
  date: string | null,
  filter: GroceryPresentationFilter,
) {
  const subcategoryKey = filter === "main-run" ? "main_run" : filter === "top-ups" ? "top_ups" : null;
  return transactions.filter(
    (transaction) => transaction.occurredOn === date && (!subcategoryKey || transaction.subcategoryKey === subcategoryKey),
  );
}

const currency = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const monthName = new Intl.DateTimeFormat("en-IL", { month: "long", timeZone: "UTC" });

function formatMonthName(month: string) {
  return monthName.format(new Date(`${month}-01T00:00:00Z`));
}

const heatmapStrengths = [0, 25, 45, 70, 100] as const;
const dailyHeatmapScaleMax = 700;
const chartMargin = { top: 24, right: 8, bottom: 32, left: 8 };
const billsChartColors = [
  "var(--analytics-bill-1)",
  "var(--analytics-bill-2)",
  "var(--analytics-bill-3)",
  "var(--analytics-bill-4)",
  "var(--analytics-bill-5)",
  "var(--analytics-bill-6)",
  "var(--analytics-bill-7)",
  "var(--analytics-bill-8)",
  "var(--analytics-bill-9)",
  "var(--analytics-bill-10)",
  "var(--analytics-bill-11)",
  "var(--analytics-bill-12)",
  "var(--analytics-bill-13)",
  "var(--analytics-bill-14)",
  "var(--analytics-bill-15)",
] as const;
export function stackedBarRadius(stack: number[], segmentIndex: number) {
  return stack[segmentIndex] > 0 && stack.slice(segmentIndex + 1).every((value) => value === 0) ? ([3, 3, 0, 0] as const) : 0;
}

export function dailyHeatmapLevel(total: number) {
  return total === 0 ? 0 : Math.min(4, Math.ceil((total / dailyHeatmapScaleMax) * 4));
}

function ExactTooltip({
  labels,
  mutedKeys = [],
  totalLabel,
}: {
  labels: Record<string, string>;
  mutedKeys?: readonly string[];
  totalLabel?: string;
}) {
  return (
    <ChartTooltip
      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
      wrapperStyle={{ zIndex: 50 }}
      content={
        <ChartTooltipContent
          className="border-border bg-popover text-popover-foreground shadow-sm"
          totalLabel={totalLabel}
          totalFormatter={(value) => currency.format(value)}
          formatter={(value, name) => {
            const muted = mutedKeys.includes(String(name));
            return (
              <>
                <span className={muted ? "text-muted-foreground" : "text-foreground"}>{labels[String(name)] ?? String(name)}</span>
                <span className={cn("ml-auto font-mono font-medium tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>
                  {currency.format(Number(value))}
                </span>
              </>
            );
          }}
        />
      }
    />
  );
}

function ChartTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Separator className="bg-foreground/20" />
      <div className="overflow-x-auto">
        <Table
          aria-label={`${label} data table`}
          className="min-w-[32rem] [&_tbody_tr]:border-border/70 [&_tbody_tr:hover]:bg-foreground/5 [&_thead_tr]:border-border/70"
        >
          {children}
        </Table>
      </div>
    </div>
  );
}

function ChartConfig({
  label,
  period,
  setPeriod,
  children,
}: {
  label: string;
  period: Period;
  setPeriod: (period: Period) => void;
  children?: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`Configure ${label}`}>
          <Settings2 aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <PopoverHeader>
          <PopoverTitle>{label} controls</PopoverTitle>
        </PopoverHeader>
        <FieldGroup className="mt-3 gap-4">
          <Field>
            <FieldLabel htmlFor={`${label}-period`}>Chart period</FieldLabel>
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger id={`${label}-period`} className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="rolling">Past 12 months</SelectItem>
                  <SelectItem value="calendar">Calendar year</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {children}
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function BillOptions({
  bills: options,
  selectedBills,
  toggleBill,
  selectOnlyBill,
}: {
  bills: Array<{ value: BillKey; label: string; color: string }>;
  selectedBills: BillKey[];
  toggleBill: (value: BillKey) => void;
  selectOnlyBill?: (value: BillKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleBills = useMemo(
    () =>
      options
        .filter((bill) => bill.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [options, query],
  );

  return (
    <Field>
      <FieldLabel>Bills shown</FieldLabel>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-between gap-2 text-left"
            aria-label="Select Bills shown"
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedBills.length === options.length
                ? "All bills"
                : `${selectedBills.length} ${selectedBills.length === 1 ? "Bill" : "Bills"} selected`}
            </span>
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
          <Input
            aria-label="Search Bills"
            autoComplete="off"
            name="bill-search"
            placeholder="Search Bills…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <FieldSet className="mx-0.5 mb-2 max-h-56 overflow-y-auto">
            <FieldLegend variant="label" className="sr-only">
              Bills shown
            </FieldLegend>
            {visibleBills.map((bill) => {
              const selected = selectedBills.includes(bill.value);
              return (
                <Field
                  key={bill.value}
                  id={`bills-option-${bill.value}`}
                  orientation="horizontal"
                  data-disabled={selected && selectedBills.length === 1}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    selectOnlyBill?.(bill.value);
                  }}
                >
                  <Checkbox
                    id={`bills-${bill.value}`}
                    checked={selected}
                    disabled={selected && selectedBills.length === 1}
                    onCheckedChange={() => toggleBill(bill.value)}
                  />
                  <FieldLabel htmlFor={`bills-${bill.value}`}>
                    <Badge variant="outline" color={bill.color} className="max-w-full truncate">
                      {bill.label}
                    </Badge>
                  </FieldLabel>
                </Field>
              );
            })}
            {visibleBills.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No matching Bills.</p> : null}
          </FieldSet>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function YearOverYearOptions({
  bills,
  value,
  onValueChange,
}: {
  bills: Array<{ value: BillKey; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="year-over-year-series">Compare</FieldLabel>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="year-over-year-series" className="min-h-11 w-full" aria-label="Select comparison series">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="gas">Gas</SelectItem>
            {bills.map((bill) => (
              <SelectItem key={bill.value} value={bill.value}>
                {bill.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ChartCard({
  id,
  title,
  description,
  action,
  children,
  layoutClassName,
  detailSuffix,
  backHref,
  detail,
}: {
  id: AnalyticsChartId;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  layoutClassName?: string;
  detailSuffix: string;
  backHref?: string;
  detail?: boolean;
}) {
  const content = <div className={cn("flex flex-col gap-6", !detail && id !== "bills" && "h-full")}>{children}</div>;

  return (
    <Card
      data-chart-card={id}
      className={cn(
        "min-w-0 border-border",
        "bg-card/80",
        "overflow-visible",
        "px-3 py-7",
        detail && "rounded-none border-0 bg-transparent px-0 py-0 ring-0 shadow-none hover:shadow-none lg:h-[calc(100dvh-4rem)]",
        layoutClassName,
      )}
    >
      <CardHeader
        className={cn(
          !detail && "has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
          detail && "px-0",
        )}
      >
        <CardTitle role="heading" aria-level={detail ? 1 : 2}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction
          className={cn(
            "flex gap-1",
            !detail &&
              "col-start-1 row-start-3 mt-2 justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-1 sm:justify-self-end",
          )}
        >
          {action}
          {!detail ? (
            <Button asChild size="icon" variant="ghost" className="size-11">
              <Link href={`/analytics/${id}${detailSuffix}`} aria-label={`Open ${title} details`}>
                <Maximize2 aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {backHref ? (
            <Button asChild size="icon" variant="ghost" className="size-11">
              <Link href={backHref} aria-label="Back to Analytics">
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col", detail && "min-h-0 overflow-y-auto px-0 pb-4")}>{content}</CardContent>
    </Card>
  );
}

type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

function AnalyticsCharts({
  detailChart,
  data,
  initialBillIds,
  initialYoy,
  initialPeriod,
}: {
  detailChart?: AnalyticsChartId;
  data: AnalyticsData;
  initialBillIds: string[];
  initialYoy: string;
  initialPeriod: Period;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detail = detailChart !== undefined;
  const chartHeightClass = detail ? "h-[320px]" : "h-[295px]";
  const period = initialPeriod;
  const chartBills = data.bills.subcategories.map((bill, index) => ({
    value: bill.id,
    label: bill.name,
    color: billsChartColors[index % billsChartColors.length],
  }));
  const presentation = parseAnalyticsPresentationState(new URLSearchParams(searchParams), {
    availableBillIds: chartBills.map((bill) => bill.value),
    fallbackBillIds: initialBillIds,
    fallbackYoy: initialYoy,
  });
  const selectedBills = presentation.billIds;
  const orderedSelectedBills = chartBills.filter((bill) => selectedBills.includes(bill.value));
  const showBillsLegends = orderedSelectedBills.length > 0;
  const billsLegendHeight = showBillsLegends ? Math.ceil(orderedSelectedBills.length / 5) * 28 + 12 : 0;
  const yearOverYearSelection = presentation.yoy;
  const isGasYearOverYear = yearOverYearSelection === "gas";
  const groceryFilter = presentation.grocery;
  const billMonthlyData: MonthlyChartDatum[] = data.months.map((month) => ({
    month,
    ...Object.fromEntries(
      chartBills.map((bill) => [
        bill.value,
        (data.bills.monthly.find((value) => value.month === month && value.subcategoryId === bill.value)?.agorot ?? 0) / 100,
      ]),
    ),
  }));
  const billTableData = billMonthlyData.filter((month) => selectedBills.some((bill) => Number(month[bill] ?? 0) > 0));
  const billsAverage =
    billTableData.length > 0
      ? billMonthlyData.reduce(
          (total, month) => total + orderedSelectedBills.reduce((monthTotal, bill) => monthTotal + Number(month[bill.value] ?? 0), 0),
          0,
        ) / billMonthlyData.length
      : null;
  const billsChartData = billMonthlyData.map((month) => ({ ...month, average: billsAverage }));
  const groceryBudgetAgorot = data.groceries.monthly.budgetAgorot;
  const groceryMonthlyData: GroceryMonthlyDatum[] = data.groceries.monthly.months.map((month) => ({
    month: month.month,
    mainRun: month.mainRunAgorot / 100,
    topUps: month.topUpsAgorot / 100,
    ...(groceryBudgetAgorot == null ? {} : { budget: groceryBudgetAgorot / 100 }),
  }));
  const groceryMonthlyTableData = groceryMonthlyData.filter((month) => month.mainRun + month.topUps > 0);
  const mainRun = data.groceries.subcategories.mainRun;
  const topUps = data.groceries.subcategories.topUps;
  const groceryColor = "var(--analytics-groceries-heatmap)";
  const groceryChartConfig = {
    mainRun: { label: mainRun?.name ?? "Main run", color: "var(--analytics-groceries-main-run)" },
    topUps: { label: topUps?.name ?? "Top-ups", color: "var(--analytics-groceries-top-ups)" },
    budget: { label: "Monthly budget", color: "var(--color-muted-foreground)" },
  } satisfies ChartConfig;
  const yearOverYearBillDetails = chartBills.find((bill) => bill.value === yearOverYearSelection) ?? chartBills[0];
  const yearOverYearBaseData: YearOverYearDatum[] = isGasYearOverYear
    ? (data.gas?.months ?? []).map(({ bike, car, month, previousBike, previousCar, previousTotal, total }) => ({
        bike,
        car,
        current: total,
        month,
        previous: previousTotal,
        previousBike,
        previousCar,
      }))
    : alignBillYearOverYear(data.months, data.bills.monthly, yearOverYearSelection).map(({ month, currentAgorot, previousAgorot }) => ({
        month,
        current: currentAgorot / 100,
        ...(previousAgorot === undefined ? {} : { previous: previousAgorot / 100 }),
      }));
  const yearOverYearAverage = yearOverYearBaseData.some((month) => month.current > 0)
    ? yearOverYearBaseData.slice(-3).reduce((total, month) => total + month.current, 0) / Math.min(yearOverYearBaseData.length, 3)
    : null;
  const yearOverYearData = yearOverYearBaseData.map((value) => ({ ...value, currentAverage: yearOverYearAverage }));
  const hasYearOverYearData = yearOverYearData.some((month) => month.current > 0 || month.previous !== undefined);
  const yearOverYearTableData = yearOverYearData.filter((month) => month.current > 0 || (month.previous ?? 0) > 0);
  const yearOverYearChartConfig = {
    current: {
      label: isGasYearOverYear ? "Gas · current year" : `${yearOverYearBillDetails?.label ?? "Bills"} · current year`,
      color: "var(--analytics-year-over-year-current)",
    },
    previous: {
      label: isGasYearOverYear ? "Gas · previous year" : `${yearOverYearBillDetails?.label ?? "Bills"} · previous year`,
      color: "var(--analytics-year-over-year-previous)",
    },
    currentAverage: { label: "3-month average", color: "var(--color-muted-foreground)" },
    bike: { label: "Bike · current year", color: "var(--analytics-bill-1)" },
    car: { label: "Car · current year", color: "var(--analytics-bill-11)" },
    previousBike: { label: "Bike · previous year", color: "var(--analytics-bill-1)" },
    previousCar: { label: "Car · previous year", color: "var(--analytics-bill-11)" },
  } satisfies ChartConfig;
  const dailyData = data.groceries.daily
    .map((day) => ({
      date: day.date,
      mainRun: day.mainRunAgorot / 100,
      topUps: day.topUpsAgorot / 100,
      total: day.totalAgorot / 100,
    }))
    .map((day) => ({
      ...day,
      mainRun: groceryFilter === "top-ups" ? 0 : day.mainRun,
      topUps: groceryFilter === "main-run" ? 0 : day.topUps,
      total: groceryFilter === "main-run" ? day.mainRun : groceryFilter === "top-ups" ? day.topUps : day.total,
    }));
  const groceryMonth = searchParams.get("groceryMonth") ?? dailyData[0]?.date.slice(0, 7) ?? "";
  const groceryYear = groceryMonth.slice(0, 4);
  const groceryMonthNumber = groceryMonth.slice(5, 7);
  const groceryYears = [...new Set(data.months.map((month) => month.slice(0, 4)))];
  const groceryMonthsForYear = data.months.filter((month) => month.startsWith(`${groceryYear}-`));
  const dailyHeatmapOffset = dailyData.length ? new Date(`${dailyData[0].date}T12:00:00`).getDay() : 0;
  const dailyHeatmapCells: Array<(typeof dailyData)[number] | null> = [
    ...Array.from({ length: dailyHeatmapOffset }, () => null),
    ...dailyData,
  ];
  const dailyHeatmapWeeks = Array.from({ length: Math.ceil(dailyHeatmapCells.length / 7) }, (_, index) =>
    dailyHeatmapCells.slice(index * 7, index * 7 + 7),
  );
  const dailyTableData = dailyData.reduce<Array<(typeof dailyData)[number] & { cumulative: number }>>(
    (rows, day) => [...rows, { ...day, cumulative: (rows.at(-1)?.cumulative ?? 0) + day.total }],
    [],
  );
  const dailyTableRows = dailyTableData.filter((day) => day.total > 0);

  function navigate(updates: AnalyticsUrlUpdates) {
    const url = buildAnalyticsUrl(pathname, new URLSearchParams(searchParams), updates);
    if (analyticsNavigationKind(updates) === "data") router.push(url);
    else window.history.pushState(null, "", url);
  }

  function changePeriod(nextPeriod: Period) {
    navigate({ period: nextPeriod });
  }

  function toggleBill(value: BillKey) {
    const next = !selectedBills.includes(value)
      ? [...selectedBills, value]
      : selectedBills.length === 1
        ? selectedBills
        : selectedBills.filter((bill) => bill !== value);
    navigate({ bills: next.join(",") });
  }

  function selectOnlyBill(value: BillKey) {
    navigate({ bills: value });
  }

  const detailQuery = new URLSearchParams(searchParams).toString();
  const detailSuffix = detailQuery ? `?${detailQuery}` : "";

  return (
    <section aria-label="Analytics charts" className={cn("grid gap-4", detail ? "mt-0" : "mt-6 xl:grid-cols-2")}>
      {(!detailChart || detailChart === "bills") && (
        <ChartCard
          id="bills"
          layoutClassName="xl:col-span-2 xl:self-start"
          title="Bills by month"
          description="Prorated totals by billing period."
          detailSuffix={detailSuffix}
          backHref={detail ? `/analytics${detailSuffix}` : undefined}
          detail={detail}
          action={
            <ChartConfig label="Bills by month" period={period} setPeriod={changePeriod}>
              <BillOptions bills={chartBills} selectedBills={selectedBills} toggleBill={toggleBill} selectOnlyBill={selectOnlyBill} />
            </ChartConfig>
          }
        >
          {[false, true].map((withLegend) => (
            <ChartContainer
              key={String(withLegend)}
              config={Object.fromEntries([
                ...chartBills.map((bill) => [bill.value, { label: bill.label, color: bill.color }]),
                ["average", { label: "Average", color: "var(--color-muted-foreground)" }],
              ])}
              className={cn(
                "w-full shrink-0 aspect-auto",
                withLegend
                  ? detail
                    ? "hidden md:flex h-[320px]"
                    : "hidden md:flex md:h-[calc(295px+var(--bills-legend-height))]"
                  : `${chartHeightClass} md:hidden`,
              )}
              style={withLegend ? ({ "--bills-legend-height": `${billsLegendHeight}px` } as CSSProperties) : undefined}
              role="region"
              aria-label="Stacked monthly Bills chart, use arrow keys to inspect values"
            >
              <BarChart accessibilityLayer data={billsChartData} margin={chartMargin}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => `₪${value}`} />
                <ExactTooltip
                  labels={{ ...Object.fromEntries(chartBills.map((bill) => [bill.value, bill.label])), average: "Average" }}
                  totalLabel="Total"
                />
                {billsAverage != null ? (
                  <Line
                    dataKey="average"
                    type="linear"
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                ) : null}
                {withLegend && showBillsLegends && (
                  <ChartLegend
                    height={billsLegendHeight}
                    content={<ChartLegendContent className="grid w-full grid-cols-5 gap-x-3 gap-y-2 [&>div]:truncate" />}
                  />
                )}
                {orderedSelectedBills.map((bill, index) => (
                  <Bar key={bill.value} dataKey={bill.value} stackId="bills" fill={bill.color}>
                    {billMonthlyData.map((month) => (
                      <Cell
                        key={month.month}
                        radius={
                          stackedBarRadius(
                            orderedSelectedBills.map((item) => Number(month[item.value] ?? 0)),
                            index,
                          ) as unknown as number
                        }
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ChartContainer>
          ))}
          {chartBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a Bills subcategory to see monthly spending.</p>
          ) : !billMonthlyData.some((month) => selectedBills.some((bill) => Number(month[bill] ?? 0) > 0)) ? (
            <p className="text-sm text-muted-foreground">No Bills data yet.</p>
          ) : null}
          {detailChart === "bills" && billTableData.length > 0 && (
            <ChartTable label="Bills by month">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {orderedSelectedBills.map((bill) => (
                    <TableHead key={bill.value}>{bill.label}</TableHead>
                  ))}
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billTableData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>{month.month}</TableCell>
                    {orderedSelectedBills.map((bill) => (
                      <TableCell key={bill.value} className="tabular-nums">
                        {currency.format(Number(month[bill.value] ?? 0))}
                      </TableCell>
                    ))}
                    <TableCell className="font-medium tabular-nums">
                      {currency.format(orderedSelectedBills.reduce((total, bill) => total + Number(month[bill.value] ?? 0), 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ChartTable>
          )}
        </ChartCard>
      )}

      {(!detailChart || detailChart === "year-over-year") && (
        <ChartCard
          id="year-over-year"
          layoutClassName="xl:col-span-2 xl:self-start"
          title="Year-over-year"
          description="Current and previous year comparison."
          detailSuffix={detailSuffix}
          backHref={detail ? `/analytics${detailSuffix}` : undefined}
          detail={detail}
          action={
            <ChartConfig label="Year-over-year" period={period} setPeriod={changePeriod}>
              <YearOverYearOptions bills={chartBills} value={yearOverYearSelection} onValueChange={(value) => navigate({ yoy: value })} />
            </ChartConfig>
          }
        >
          <ChartContainer
            config={yearOverYearChartConfig}
            className={cn(chartHeightClass, "w-full")}
            role="region"
            aria-label={`${isGasYearOverYear ? "Gas" : (yearOverYearBillDetails?.label ?? "Bills")} year-over-year chart, use arrow keys to inspect values`}
          >
            <BarChart accessibilityLayer data={yearOverYearData} margin={chartMargin}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => `₪${value}`} />
              <ExactTooltip
                labels={
                  isGasYearOverYear
                    ? {
                        bike: "Bike · current year",
                        car: "Car · current year",
                        previousBike: "Bike · previous year",
                        previousCar: "Car · previous year",
                        currentAverage: "3-month average",
                      }
                    : { current: "Current year", previous: "Previous year", currentAverage: "3-month average" }
                }
                mutedKeys={isGasYearOverYear ? ["previousBike", "previousCar"] : ["previous"]}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {isGasYearOverYear ? (
                <>
                  {(["previousBike", "previousCar", "bike", "car"] as const).map((key, index) => {
                    const stack = key.startsWith("previous") ? "previous" : "current";
                    const segmentIndex = stack === "previous" ? index : index - 2;
                    return (
                      <Bar
                        key={key}
                        dataKey={key}
                        fill={`var(--color-${key})`}
                        fillOpacity={stack === "previous" ? 0.38 : 1}
                        stackId={stack}
                      >
                        {yearOverYearData.map((month) => (
                          <Cell
                            key={month.month}
                            radius={
                              stackedBarRadius(
                                stack === "previous"
                                  ? [Number(month.previousBike ?? 0), Number(month.previousCar ?? 0)]
                                  : [Number(month.bike ?? 0), Number(month.car ?? 0)],
                                segmentIndex,
                              ) as unknown as number
                            }
                          />
                        ))}
                      </Bar>
                    );
                  })}
                </>
              ) : (
                <>
                  <Bar dataKey="previous" fill="var(--color-previous)" fillOpacity={0.38} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} />
                </>
              )}
              {yearOverYearAverage != null ? (
                <Line
                  dataKey="currentAverage"
                  type="linear"
                  stroke="var(--color-currentAverage)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              ) : null}
            </BarChart>
          </ChartContainer>
          {!hasYearOverYearData ? (
            <p className="text-sm text-muted-foreground">
              {isGasYearOverYear
                ? data.gas
                  ? "No Gas data yet."
                  : "Add an active Car or Bike fuel subcategory to see this trend."
                : "No Bills data yet."}
            </p>
          ) : null}
          {detailChart === "year-over-year" && yearOverYearTableData.length > 0 && (
            <ChartTable label="Year-over-year">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {isGasYearOverYear ? (
                    <>
                      <TableHead>Current Bike</TableHead>
                      <TableHead>Current Car</TableHead>
                      <TableHead>Current total</TableHead>
                      <TableHead>Previous Bike</TableHead>
                      <TableHead>Previous Car</TableHead>
                      <TableHead>Previous total</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Current year</TableHead>
                      <TableHead>Previous year</TableHead>
                    </>
                  )}
                  <TableHead>3-month average</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearOverYearTableData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>{month.month}</TableCell>
                    {isGasYearOverYear ? (
                      <>
                        <TableCell className="tabular-nums">{currency.format(Number(month.bike ?? 0))}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(Number(month.car ?? 0))}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(month.current)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(Number(month.previousBike ?? 0))}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(Number(month.previousCar ?? 0))}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(Number(month.previous ?? 0))}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="tabular-nums">{currency.format(month.current)}</TableCell>
                        <TableCell className="tabular-nums">
                          {month.previous === undefined ? "No previous-year data" : currency.format(month.previous)}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="tabular-nums">
                      {month.currentAverage == null ? "—" : currency.format(month.currentAverage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ChartTable>
          )}
        </ChartCard>
      )}

      {(!detailChart || detailChart === "groceries" || detailChart === "daily") && (
        <div className={cn("grid gap-4", !detail && "xl:col-span-2 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
          {(!detailChart || detailChart === "groceries") && (
            <ChartCard
              id="groceries"
              title="Groceries by month"
              description="Posting-date totals by month."
              detailSuffix={detailSuffix}
              backHref={detail ? `/analytics${detailSuffix}` : undefined}
              detail={detail}
              action={<ChartConfig label="Groceries by month" period={period} setPeriod={changePeriod} />}
            >
              <ChartContainer
                config={groceryChartConfig}
                className={cn(chartHeightClass, "w-full", !detail && "flex-1")}
                role="region"
                aria-label="Stacked monthly groceries chart, use arrow keys to inspect values"
              >
                <BarChart accessibilityLayer data={groceryMonthlyData} margin={chartMargin}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(value) => `₪${value}`} />
                  <ExactTooltip
                    labels={{ mainRun: mainRun?.name ?? "Main run", topUps: topUps?.name ?? "Top-ups", budget: "Monthly budget" }}
                    totalLabel="Total"
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {groceryBudgetAgorot != null ? (
                    <Line
                      dataKey="budget"
                      type="linear"
                      stroke="var(--color-budget)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  ) : null}
                  <Bar dataKey="mainRun" stackId="groceries" fill="var(--color-mainRun)">
                    {groceryMonthlyData.map((month) => (
                      <Cell key={month.month} radius={stackedBarRadius([month.mainRun, month.topUps], 0) as unknown as number} />
                    ))}
                  </Bar>
                  <Bar dataKey="topUps" stackId="groceries" fill="var(--color-topUps)">
                    {groceryMonthlyData.map((month) => (
                      <Cell key={month.month} radius={stackedBarRadius([month.mainRun, month.topUps], 1) as unknown as number} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              {detailChart === "groceries" && groceryMonthlyTableData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Groceries data yet.</p>
              ) : null}
              {detailChart === "groceries" && groceryMonthlyTableData.length > 0 && (
                <ChartTable label="Groceries by month">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Main run</TableHead>
                      <TableHead>Top-ups</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groceryMonthlyTableData.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell>{month.month}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(month.mainRun)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(month.topUps)}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(month.mainRun + month.topUps)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ChartTable>
              )}
            </ChartCard>
          )}

          {(!detailChart || detailChart === "daily") && (
            <ChartCard
              id="daily"
              title="Groceries by day"
              description="Daily spending, including no-spend days."
              detailSuffix={detailSuffix}
              backHref={detail ? `/analytics${detailSuffix}` : undefined}
              detail={detail}
              action={
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Configure Groceries by day">
                      <Settings2 aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 max-w-[calc(100vw-2rem)] p-3">
                    <PopoverHeader>
                      <PopoverTitle>Show spending</PopoverTitle>
                    </PopoverHeader>
                    <FieldGroup className="mt-3 gap-3">
                      <FieldGroup className="grid grid-cols-2 gap-2">
                        <Field>
                          <FieldLabel htmlFor="groceries-year">Year</FieldLabel>
                          <Select
                            value={groceryYear}
                            onValueChange={(year) => {
                              const month = `${year}-${groceryMonthNumber}`;
                              navigate({
                                groceryMonth: data.months.includes(month)
                                  ? month
                                  : (data.months.find((value) => value.startsWith(`${year}-`)) ?? groceryMonth),
                              });
                            }}
                          >
                            <SelectTrigger id="groceries-year" aria-label="Select Groceries year" className="min-h-11 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {groceryYears.map((year) => (
                                  <SelectItem key={year} value={year}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="groceries-month">Month</FieldLabel>
                          <Select
                            value={groceryMonthNumber}
                            onValueChange={(month) => navigate({ groceryMonth: `${groceryYear}-${month}` })}
                          >
                            <SelectTrigger id="groceries-month" aria-label="Select Groceries month" className="min-h-11 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {groceryMonthsForYear.map((month) => (
                                  <SelectItem key={month} value={month.slice(5, 7)}>
                                    {formatMonthName(month)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      </FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="groceries-spending">Show spending</FieldLabel>
                        <Select
                          value={groceryFilter}
                          onValueChange={(value: GroceryPresentationFilter) => {
                            navigate({ grocery: value === "all" ? null : value });
                          }}
                        >
                          <SelectTrigger id="groceries-spending" aria-label="Show spending" className="min-h-11 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="main-run">Main run</SelectItem>
                              <SelectItem value="top-ups">Top-ups</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  </PopoverContent>
                </Popover>
              }
            >
              <div
                className="mx-2 mt-1.5 flex w-auto flex-1 flex-col gap-8 pt-1 pr-3.5 pb-0.5 pl-3.5"
                role="grid"
                aria-label="Groceries by day heatmap"
              >
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground" role="row">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <span key={day} role="columnheader">
                      {day}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5" role="rowgroup">
                  {dailyHeatmapWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="contents" role="row">
                      {week.map((day, dayIndex) => {
                        if (!day) return <span key={`empty-${dayIndex}`} aria-hidden="true" />;
                        const level = dailyHeatmapLevel(day.total);
                        const transactions = groceryTransactionsForDate(data.groceries.transactions, day.date, groceryFilter);
                        return (
                          <Popover key={day.date}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                role="gridcell"
                                title={`${day.date}: ${currency.format(day.total)}`}
                                aria-label={`${day.date}: ${currency.format(day.total)}`}
                                variant="ghost"
                                className={cn(
                                  "relative flex h-11 items-center justify-center rounded-md text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:before:absolute hover:before:inset-0 hover:before:rounded-md hover:before:bg-foreground/5 sm:h-20 xl:h-auto xl:aspect-square",
                                  level === 0 && "bg-card text-muted-foreground",
                                )}
                                style={
                                  level > 0
                                    ? {
                                        backgroundColor: `color-mix(in oklab, ${groceryColor} ${heatmapStrengths[level]}%, transparent)`,
                                      }
                                    : undefined
                                }
                              >
                                <span className={cn("relative", level > 0 && "text-white")}>{day.date.slice(8)}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent side="right" align="start" sideOffset={8} className="w-72 p-4">
                              <PopoverHeader>
                                <PopoverTitle>Groceries on {day.date}</PopoverTitle>
                              </PopoverHeader>
                              {transactions.length > 0 ? (
                                <ul className="mt-3 flex flex-col gap-3">
                                  {transactions.map((transaction) => (
                                    <li key={transaction.id} className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium">{transaction.merchant || transaction.note || "Groceries"}</p>
                                        {transaction.merchant && transaction.note ? (
                                          <p className="truncate text-muted-foreground">{transaction.note}</p>
                                        ) : null}
                                      </div>
                                      <span className="shrink-0 font-mono tabular-nums">{currency.format(transaction.amount)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-3 text-muted-foreground">No Groceries expenses recorded.</p>
                              )}
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-auto flex items-center justify-center gap-2 text-xs text-muted-foreground"
                  aria-label="Total daily spending heatmap legend"
                >
                  <span>Lower</span>
                  {heatmapStrengths.map((strength, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={cn("size-3 rounded-sm", index === 0 && "bg-muted text-muted-foreground")}
                      style={index > 0 ? { backgroundColor: `color-mix(in oklab, ${groceryColor} ${strength}%, transparent)` } : undefined}
                    />
                  ))}
                  <span>Higher</span>
                </div>
              </div>
              {detailChart === "daily" && dailyTableRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Groceries data yet.</p>
              ) : null}
              {detailChart === "daily" && dailyTableRows.length > 0 && (
                <ChartTable label="Groceries by day">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Main run</TableHead>
                      <TableHead>Top-ups</TableHead>
                      <TableHead>Daily total</TableHead>
                      <TableHead>Cumulative total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTableRows.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(day.mainRun)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(day.topUps)}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(day.total)}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(day.cumulative)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </ChartTable>
              )}
            </ChartCard>
          )}
        </div>
      )}
    </section>
  );
}

export function AnalyticsDashboard({
  data,
  billIds,
  yoy,
  period,
}: {
  data: AnalyticsData;
  billIds: string[];
  yoy: string;
  period: Period;
}) {
  return <AnalyticsCharts data={data} initialBillIds={billIds} initialPeriod={period} initialYoy={yoy} />;
}

export function AnalyticsChartDetail({
  chart,
  data,
  billIds,
  yoy,
  period,
}: {
  chart: AnalyticsChartId;
  data: AnalyticsData;
  billIds: string[];
  yoy: string;
  period: Period;
}) {
  return <AnalyticsCharts detailChart={chart} data={data} initialBillIds={billIds} initialPeriod={period} initialYoy={yoy} />;
}
