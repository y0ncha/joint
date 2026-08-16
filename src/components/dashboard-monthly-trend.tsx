"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type DashboardMonthlyTrendRow = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
};

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  notation: "compact",
  maximumFractionDigits: 0,
});
const month = new Intl.DateTimeFormat("en-IL", { month: "short", year: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-IL", { month: "short", timeZone: "UTC" });

const chartConfig = {
  income: { label: "Income", color: "var(--analytics-bill-1)" },
  expenses: { label: "Outgoings", color: "var(--analytics-bill-11)" },
  savings: { label: "Monthly balance", color: "var(--analytics-bill-15)" },
  savingsAverage: { label: "Balance avg", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;

function monthDate(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
}

export function DashboardMonthlyTrend({ data }: { data: DashboardMonthlyTrendRow[] }) {
  const chartData = data.map((value, index) => ({
    ...value,
    savingsAverage: index < 2 ? null : (data[index - 2].savings + data[index - 1].savings + value.savings) / 3,
  }));

  return (
    <Card className="min-w-0 border-white/50 bg-card/90 lg:col-span-12">
      <CardHeader>
        <CardTitle>Balance trend</CardTitle>
        <CardDescription>Monthly income, outgoings, balance, and three-month average.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 px-6">
        <ChartContainer config={chartConfig} className="min-h-72 w-full" aria-label="Six-month household balance trend">
          <LineChart accessibilityLayer data={chartData} margin={{ left: 8, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value: string) => shortMonth.format(monthDate(value))}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => compactCurrency.format(value)}
              width={64}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => month.format(monthDate(String(payload[0]?.payload?.month ?? "")))}
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                      <span className="font-mono font-medium tabular-nums">{currency.format(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="income"
              type="monotone"
              stroke="var(--color-income)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="expenses"
              type="monotone"
              stroke="var(--color-expenses)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="savings"
              type="monotone"
              stroke="var(--color-savings)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="savingsAverage"
              type="monotone"
              stroke="var(--color-savingsAverage)"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
        <div className="min-w-0">
          <Table>
            <caption className="sr-only">Exact monthly values for the six-month household money trend.</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Outgoings</TableHead>
                <TableHead className="text-right">Monthly balance</TableHead>
                <TableHead className="text-right">3-month average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...chartData].reverse().map((value) => (
                <TableRow key={value.month}>
                  <TableCell>{month.format(monthDate(value.month))}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{currency.format(value.income)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{currency.format(value.expenses)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{currency.format(value.savings)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {value.savingsAverage == null ? "—" : currency.format(value.savingsAverage)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
