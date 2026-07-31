"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, ChevronDown, Maximize2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type BillKey = "electricity" | "water" | "internet";
type Period = "rolling" | "calendar";
export type EssentialsChartId = "bills" | "yoy" | "groceries" | "daily";
type MonthlyFixture = {
  month: string;
  electricity: number;
  water: number;
  internet: number;
  mainRun: number;
  topUps: number;
};

const currency = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const bills = [
  { value: "electricity", label: "Electricity", color: "var(--chart-1)" },
  { value: "water", label: "Water", color: "var(--chart-2)" },
  { value: "internet", label: "Internet", color: "var(--chart-3)" },
] satisfies Array<{ value: BillKey; label: string; color: string }>;

const monthlyFixtures: Record<Period, MonthlyFixture[]> = {
  rolling: [
    { month: "Aug 25", electricity: 312, water: 138, internet: 119, mainRun: 1530, topUps: 342 },
    { month: "Sep 25", electricity: 286, water: 126, internet: 119, mainRun: 1440, topUps: 298 },
    { month: "Oct 25", electricity: 264, water: 131, internet: 119, mainRun: 1620, topUps: 366 },
    { month: "Nov 25", electricity: 248, water: 122, internet: 119, mainRun: 1485, topUps: 315 },
    { month: "Dec 25", electricity: 278, water: 129, internet: 119, mainRun: 1710, topUps: 402 },
    { month: "Jan 26", electricity: 336, water: 141, internet: 119, mainRun: 1570, topUps: 348 },
    { month: "Feb 26", electricity: 354, water: 136, internet: 119, mainRun: 1460, topUps: 321 },
    { month: "Mar 26", electricity: 310, water: 133, internet: 119, mainRun: 1650, topUps: 386 },
    { month: "Apr 26", electricity: 282, water: 128, internet: 119, mainRun: 1510, topUps: 304 },
    { month: "May 26", electricity: 260, water: 124, internet: 119, mainRun: 1680, topUps: 372 },
    { month: "Jun 26", electricity: 298, water: 132, internet: 119, mainRun: 1595, topUps: 337 },
    { month: "Jul 26", electricity: 326, water: 145, internet: 119, mainRun: 1725, topUps: 411 },
  ],
  calendar: [
    { month: "Jan", electricity: 336, water: 141, internet: 119, mainRun: 1570, topUps: 348 },
    { month: "Feb", electricity: 354, water: 136, internet: 119, mainRun: 1460, topUps: 321 },
    { month: "Mar", electricity: 310, water: 133, internet: 119, mainRun: 1650, topUps: 386 },
    { month: "Apr", electricity: 282, water: 128, internet: 119, mainRun: 1510, topUps: 304 },
    { month: "May", electricity: 260, water: 124, internet: 119, mainRun: 1680, topUps: 372 },
    { month: "Jun", electricity: 298, water: 132, internet: 119, mainRun: 1595, topUps: 337 },
    { month: "Jul", electricity: 326, water: 145, internet: 119, mainRun: 1725, topUps: 411 },
    { month: "Aug", electricity: 0, water: 0, internet: 0, mainRun: 0, topUps: 0 },
    { month: "Sep", electricity: 0, water: 0, internet: 0, mainRun: 0, topUps: 0 },
    { month: "Oct", electricity: 0, water: 0, internet: 0, mainRun: 0, topUps: 0 },
    { month: "Nov", electricity: 0, water: 0, internet: 0, mainRun: 0, topUps: 0 },
    { month: "Dec", electricity: 0, water: 0, internet: 0, mainRun: 0, topUps: 0 },
  ],
};

const previousYear = {
  rolling: {
    electricity: [284, 302, 251, 243, 269, 310, 328, 296, 271, 248, 276, 301],
    water: [126, 121, 127, 119, 123, 132, 128, 126, 122, 118, 124, 137],
    internet: [109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109],
  },
  calendar: {
    electricity: [310, 328, 296, 271, 248, 276, 301, 284, 302, 251, 243, 269],
    water: [132, 128, 126, 122, 118, 124, 137, 126, 121, 127, 119, 123],
    internet: [109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109],
  },
} as const;

const dailyFixtures = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  const mainRun = [3, 10, 17, 24, 31].includes(day) ? 380 + day * 3 : 0;
  const topUps = [2, 6, 9, 13, 16, 20, 23, 27, 29].includes(day) ? 54 + day * 2 : 0;

  return {
    date: `2026-07-${String(day).padStart(2, "0")}`,
    mainRun,
    topUps,
    total: mainRun + topUps,
  };
});
const dailyFixtureStart = new Date(2026, 6, 1);
const dailyFixtureEnd = new Date(2026, 6, 31);

const billChartConfig = Object.fromEntries(
  bills.map((bill) => [bill.value, { label: bill.label, color: bill.color }]),
) satisfies ChartConfig;
const groceryChartConfig = {
  mainRun: { label: "Main run", color: "var(--chart-4)" },
  topUps: { label: "Top-ups", color: "var(--chart-5)" },
  budget: { label: "Monthly budget", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;
const dailyHeatLevels = [
  "bg-muted text-muted-foreground",
  "bg-chart-4/25",
  "bg-chart-4/45",
  "bg-chart-4/70",
  "bg-chart-4 text-primary-foreground",
] as const;
const chartMargin = { top: 24, right: 8, bottom: 32, left: 8 };

export function stackedBarRadius(stack: number[], segmentIndex: number) {
  return stack[segmentIndex] > 0 && stack.slice(segmentIndex + 1).every((value) => value === 0) ? ([3, 3, 0, 0] as const) : 0;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ExactTooltip({ labels }: { labels: Record<string, string> }) {
  return (
    <ChartTooltip
      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
      content={
        <ChartTooltipContent
          className="border-border bg-popover text-popover-foreground shadow-sm"
          formatter={(value, name) => (
            <>
              <span className="text-muted-foreground">{labels[String(name)] ?? String(name)}</span>
              <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{currency.format(Number(value))}</span>
            </>
          )}
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
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 hover:bg-foreground/5 active:bg-foreground/5"
          aria-label={`Configure ${label}`}
        >
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
  selectedBills,
  toggleBill,
  single = false,
}: {
  selectedBills: BillKey[];
  toggleBill: (value: BillKey) => void;
  single?: boolean;
}) {
  if (single) {
    return (
      <Field>
        <FieldLabel htmlFor="yoy-bill">Bill</FieldLabel>
        <Select value={selectedBills[0]} onValueChange={(value) => toggleBill(value as BillKey)}>
          <SelectTrigger id="yoy-bill" className="min-h-11 w-full" aria-label="Select Bill">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
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

  return (
    <Field>
      <FieldLabel>Bills shown</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="min-h-11 w-full justify-between" aria-label="Select Bills shown">
            {selectedBills.length === bills.length
              ? "All bills"
              : selectedBills.map((bill) => bills.find((item) => item.value === bill)?.label).join(", ")}
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3">
          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="sr-only">
              Bills shown
            </FieldLegend>
            {bills.map((bill) => {
              const selected = selectedBills.includes(bill.value);
              return (
                <Field key={bill.value} orientation="horizontal" data-disabled={selected && selectedBills.length === 1}>
                  <Checkbox
                    id={`bills-${bill.value}`}
                    checked={selected}
                    disabled={selected && selectedBills.length === 1}
                    onCheckedChange={() => toggleBill(bill.value)}
                  />
                  <FieldLabel htmlFor={`bills-${bill.value}`}>{bill.label}</FieldLabel>
                </Field>
              );
            })}
          </FieldSet>
        </PopoverContent>
      </Popover>
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
  detailHref,
  backHref,
  detail,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  layoutClassName?: string;
  detailHref?: string;
  backHref?: string;
  detail?: boolean;
}) {
  const content = <div className={cn("flex flex-col gap-6", !detail && "h-full")}>{children}</div>;

  return (
    <Card
      data-chart-card={id}
      className={cn(
        "min-w-0 border-border",
        "bg-card/80",
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
          {detailHref ? (
            <Button asChild size="icon" variant="ghost" className="size-11 hover:bg-foreground/5 active:bg-foreground/5">
              <Link href={detailHref} aria-label={`Open ${title} details`}>
                <Maximize2 aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {backHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon" variant="ghost" className="size-11 hover:bg-foreground/5 active:bg-foreground/5">
                  <Link href={backHref} aria-label="Back to Essentials">
                    <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Essentials</TooltipContent>
            </Tooltip>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col", detail && "min-h-0 overflow-y-auto px-0 pb-4")}>{content}</CardContent>
    </Card>
  );
}

function EssentialsCharts({ detailChart }: { detailChart?: EssentialsChartId }) {
  const detail = detailChart !== undefined;
  const chartHeightClass = detail ? "h-[320px]" : "h-[280px]";
  const [billPeriod, setBillPeriod] = useState<Period>("rolling");
  const [yoyPeriod, setYoyPeriod] = useState<Period>("rolling");
  const [groceryPeriod, setGroceryPeriod] = useState<Period>("rolling");
  const [selectedBills, setSelectedBills] = useState<BillKey[]>(bills.map((bill) => bill.value));
  const [yoyBill, setYoyBill] = useState<BillKey>("electricity");
  const [dailyRange, setDailyRange] = useState<DateRange>({
    from: dailyFixtureStart,
    to: dailyFixtureEnd,
  });
  const billMonthlyData = monthlyFixtures[billPeriod];
  const yoyMonthlyData = monthlyFixtures[yoyPeriod];
  const groceryMonthlyData = monthlyFixtures[groceryPeriod];
  const yoyBillDetails = bills.find((bill) => bill.value === yoyBill) ?? bills[0];
  const yoyData = yoyMonthlyData.map((month, index) => ({
    month: month.month,
    current: month[yoyBill],
    previous: previousYear[yoyPeriod][yoyBill][index],
  }));
  const yoyChartConfig = {
    current: { label: `${yoyBillDetails.label} · current year`, color: yoyBillDetails.color },
    previous: { label: `${yoyBillDetails.label} · previous year`, color: yoyBillDetails.color },
  } satisfies ChartConfig;
  const from = dailyRange.from ? toIso(dailyRange.from) : dailyFixtures[0].date;
  const to = dailyRange.to ? toIso(dailyRange.to) : from;
  const dailyData = useMemo(() => dailyFixtures.filter((day) => day.date >= from && day.date <= to), [from, to]);
  const dailyHeatmapOffset = dailyData.length ? new Date(`${dailyData[0].date}T12:00:00`).getDay() : 0;
  const highestDailyTotal = Math.max(1, ...dailyData.map((day) => day.total));

  function toggleBill(value: BillKey) {
    setSelectedBills((current) => {
      if (!current.includes(value)) return [...current, value];
      return current.length === 1 ? current : current.filter((bill) => bill !== value);
    });
  }

  return (
    <section aria-label="Essentials charts" className={cn("grid gap-4", detail ? "mt-0" : "mt-6 xl:grid-cols-2")}>
      {(!detailChart || detailChart === "bills") && (
        <ChartCard
          id="bills"
          title="Bills by month"
          description="Prorated fixture totals by billing period."
          detailHref={detailChart ? undefined : "/essentials/bills"}
          backHref={detail ? "/essentials" : undefined}
          detail={detail}
          action={
            <ChartConfig label="Bills by month" period={billPeriod} setPeriod={setBillPeriod}>
              <BillOptions selectedBills={selectedBills} toggleBill={toggleBill} />
            </ChartConfig>
          }
        >
          <ChartContainer
            config={billChartConfig}
            className={cn(chartHeightClass, "w-full", !detail && "flex-1")}
            role="region"
            aria-label="Stacked monthly Bills chart, use arrow keys to inspect values"
          >
            <BarChart accessibilityLayer data={billMonthlyData} margin={chartMargin}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => `₪${value}`} />
              <ExactTooltip labels={Object.fromEntries(bills.map((bill) => [bill.value, bill.label]))} />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedBills.map((bill, index) => (
                <Bar key={bill} dataKey={bill} stackId="bills" fill={`var(--color-${bill})`}>
                  {billMonthlyData.map((month) => (
                    <Cell
                      key={month.month}
                      radius={stackedBarRadius(
                        selectedBills.map((key) => month[key]),
                        index,
                      )}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
          {detailChart === "bills" && (
            <ChartTable label="Bills by month">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {selectedBills.map((bill) => (
                    <TableHead key={bill}>{bills.find((item) => item.value === bill)?.label}</TableHead>
                  ))}
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billMonthlyData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>{month.month}</TableCell>
                    {selectedBills.map((bill) => (
                      <TableCell key={bill} className="tabular-nums">
                        {currency.format(month[bill])}
                      </TableCell>
                    ))}
                    <TableCell className="font-medium tabular-nums">
                      {currency.format(selectedBills.reduce((total, bill) => total + month[bill], 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ChartTable>
          )}
        </ChartCard>
      )}

      {(!detailChart || detailChart === "yoy") && (
        <ChartCard
          id="yoy"
          title="Year-over-year"
          description="Current and previous year for one Bills subcategory."
          detailHref={detailChart ? undefined : "/essentials/year-over-year"}
          backHref={detail ? "/essentials" : undefined}
          detail={detail}
          action={
            <ChartConfig label="Year-over-year" period={yoyPeriod} setPeriod={setYoyPeriod}>
              <BillOptions selectedBills={[yoyBill]} toggleBill={setYoyBill} single />
            </ChartConfig>
          }
        >
          <ChartContainer
            config={yoyChartConfig}
            className={cn(chartHeightClass, "w-full", !detail && "flex-1")}
            role="region"
            aria-label={`${yoyBillDetails.label} year-over-year chart, use arrow keys to inspect values`}
          >
            <BarChart accessibilityLayer data={yoyData} margin={chartMargin}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => `₪${value}`} />
              <ExactTooltip labels={{ current: "Current year", previous: "Previous year" }} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="previous" fill="var(--color-previous)" fillOpacity={0.38} radius={[3, 3, 0, 0]} />
              <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
          {detailChart === "yoy" && (
            <ChartTable label="Year-over-year">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Current year</TableHead>
                  <TableHead>Previous year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yoyData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>{month.month}</TableCell>
                    <TableCell className="tabular-nums">{currency.format(month.current)}</TableCell>
                    <TableCell className="tabular-nums">{currency.format(month.previous)}</TableCell>
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
              description="Posting-date totals against the monthly budget fixture."
              detailHref={detailChart ? undefined : "/essentials/groceries"}
              backHref={detail ? "/essentials" : undefined}
              detail={detail}
              action={<ChartConfig label="Groceries by month" period={groceryPeriod} setPeriod={setGroceryPeriod} />}
            >
              <ChartContainer
                config={groceryChartConfig}
                className={cn(chartHeightClass, "w-full", !detail && "flex-1")}
                role="region"
                aria-label="Stacked monthly groceries chart with budget threshold, use arrow keys to inspect values"
              >
                <BarChart accessibilityLayer data={groceryMonthlyData} margin={chartMargin}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(value) => `₪${value}`} />
                  <ExactTooltip labels={{ mainRun: "Main run", topUps: "Top-ups" }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <ReferenceLine y={2200} stroke="var(--color-budget)" strokeDasharray="4 4" />
                  <Bar dataKey="mainRun" stackId="groceries" fill="var(--color-mainRun)">
                    {groceryMonthlyData.map((month) => (
                      <Cell key={month.month} radius={stackedBarRadius([month.mainRun, month.topUps], 0)} />
                    ))}
                  </Bar>
                  <Bar dataKey="topUps" stackId="groceries" fill="var(--color-topUps)">
                    {groceryMonthlyData.map((month) => (
                      <Cell key={month.month} radius={stackedBarRadius([month.mainRun, month.topUps], 1)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              {detailChart === "groceries" && (
                <ChartTable label="Groceries by month">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Main run</TableHead>
                      <TableHead>Top-ups</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Budget</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groceryMonthlyData.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell>{month.month}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(month.mainRun)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(month.topUps)}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(month.mainRun + month.topUps)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(2200)}</TableCell>
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
              detailHref={detailChart ? undefined : "/essentials/daily"}
              backHref={detail ? "/essentials" : undefined}
              detail={detail}
              action={
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 hover:bg-foreground/5 active:bg-foreground/5"
                      aria-label="Configure Groceries by day"
                    >
                      <Settings2 aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] p-3">
                    <PopoverHeader>
                      <PopoverTitle>Groceries by day range</PopoverTitle>
                    </PopoverHeader>
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="daily-from">From</FieldLabel>
                        <Input id="daily-from" value={from} readOnly />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="daily-to">To</FieldLabel>
                        <Input id="daily-to" value={to} readOnly />
                      </Field>
                    </FieldGroup>
                    <Calendar
                      mode="range"
                      month={dailyFixtureStart}
                      startMonth={dailyFixtureStart}
                      endMonth={dailyFixtureEnd}
                      disabled={{ before: dailyFixtureStart, after: dailyFixtureEnd }}
                      selected={dailyRange}
                      onSelect={(range) => {
                        if (range?.from) setDailyRange(range);
                      }}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              }
            >
              <div className="mx-2 mt-1.5 flex w-auto flex-1 flex-col gap-8 pt-1 pr-3.5 pb-0.5 pl-3.5" role="grid" aria-label="Groceries by day heatmap">
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground" role="row">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <span key={day} role="columnheader">
                      {day}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: dailyHeatmapOffset }, (_, index) => (
                    <span key={index} aria-hidden="true" />
                  ))}
                  {dailyData.map((day) => {
                    const level = day.total === 0 ? 0 : Math.min(4, Math.ceil((day.total / highestDailyTotal) * 4));
                    return (
                      <div
                        key={day.date}
                        role="gridcell"
                        tabIndex={0}
                        title={`${day.date}: ${currency.format(day.total)}`}
                        aria-label={`${day.date}: ${currency.format(day.total)}`}
                        className={cn(
                          "relative flex h-11 items-center justify-center rounded-md text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:before:absolute hover:before:inset-0 hover:before:rounded-md hover:before:bg-foreground/5 sm:h-20 xl:h-auto xl:aspect-square",
                          dailyHeatLevels[level],
                        )}
                      >
                        <span className="relative">{day.date.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-auto flex items-center justify-center gap-2 text-xs text-muted-foreground"
                  aria-label="Total daily spending heatmap legend"
                >
                  <span>Lower</span>
                  {dailyHeatLevels.map((level, index) => (
                    <span key={index} aria-hidden="true" className={cn("size-3 rounded-sm", level)} />
                  ))}
                  <span>Higher</span>
                </div>
              </div>
              {detailChart === "daily" && (
                <ChartTable label="Groceries by day">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Main run</TableHead>
                      <TableHead>Top-ups</TableHead>
                      <TableHead>Daily total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(day.mainRun)}</TableCell>
                        <TableCell className="tabular-nums">{currency.format(day.topUps)}</TableCell>
                        <TableCell className="font-medium tabular-nums">{currency.format(day.total)}</TableCell>
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

export function EssentialsDashboard() {
  return <EssentialsCharts />;
}

export function EssentialsChartDetail({ chart }: { chart: EssentialsChartId }) {
  return <EssentialsCharts detailChart={chart} />;
}
