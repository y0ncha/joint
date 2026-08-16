"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GasTrend } from "@/lib/gas-trend";
import { cn } from "@/lib/utils";

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
  bike: { label: "Bike · current year", color: "var(--analytics-bill-1)" },
  car: { label: "Car · current year", color: "var(--analytics-bill-11)" },
  previousBike: { label: "Bike · previous year", color: "var(--analytics-bill-1)" },
  previousCar: { label: "Car · previous year", color: "var(--analytics-bill-11)" },
  average: { label: "Average monthly gas", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;

function monthDate(value: string) {
  return new Date(`${value}-01T00:00:00Z`);
}

function GasTrendTooltip({
  average,
  label,
  payload,
}: {
  average: number;
  label?: string;
  payload?: Array<{ payload: GasTrend["months"][number] }>;
}) {
  const value = payload?.[0]?.payload;
  if (!value || !label) return null;

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{month.format(monthDate(label))}</p>
      <dl className="grid gap-1.5">
        {[
          ["Bike · current year", value.bike],
          ["Car · current year", value.car],
          ["Total · current year", value.total],
          ["Bike · previous year", value.previousBike],
          ["Car · previous year", value.previousCar],
          ["Total · previous year", value.previousTotal],
          ["Average monthly gas", average],
        ].map(([name, amount]) => (
          <div key={String(name)} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="font-mono font-medium tabular-nums">{currency.format(Number(amount))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function GasTrendCard({ className, data }: { className?: string; data?: GasTrend }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>Gas trend</CardTitle>
        <CardDescription>Bike and Car fuel compared with the previous year.</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <>
            <ChartContainer
              aria-label="Six-month household fuel spending trend, comparing Bike and Car with the previous year."
              className="min-h-72 w-full"
              config={chartConfig}
            >
              <BarChart accessibilityLayer data={data.months} margin={{ left: 8, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="month"
                  tickFormatter={(value: string) => shortMonth.format(monthDate(value))}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  axisLine={false}
                  tickFormatter={(value: number) => compactCurrency.format(value)}
                  tickLine={false}
                  tickMargin={8}
                  width={64}
                />
                <ChartTooltip content={<GasTrendTooltip average={data.average} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <ReferenceLine stroke="var(--color-average)" strokeDasharray="4 4" strokeOpacity={0.55} strokeWidth={2} y={data.average} />
                <Bar dataKey="previousBike" fill="var(--color-previousBike)" fillOpacity={0.35} stackId="previous" />
                <Bar dataKey="previousCar" fill="var(--color-previousCar)" fillOpacity={0.35} stackId="previous" />
                <Bar dataKey="bike" fill="var(--color-bike)" stackId="current" />
                <Bar dataKey="car" fill="var(--color-car)" stackId="current" />
              </BarChart>
            </ChartContainer>
            <Table className="sr-only">
              <caption>Exact monthly Bike, Car, and total fuel spending for the six-month gas trend.</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Bike</TableHead>
                  <TableHead>Car</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Previous Bike</TableHead>
                  <TableHead>Previous Car</TableHead>
                  <TableHead>Previous total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((value) => (
                  <TableRow key={value.month}>
                    <TableCell>{month.format(monthDate(value.month))}</TableCell>
                    <TableCell>{currency.format(value.bike)}</TableCell>
                    <TableCell>{currency.format(value.car)}</TableCell>
                    <TableCell>{currency.format(value.total)}</TableCell>
                    <TableCell>{currency.format(value.previousBike)}</TableCell>
                    <TableCell>{currency.format(value.previousCar)}</TableCell>
                    <TableCell>{currency.format(value.previousTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Add an active Car or Bike fuel subcategory to see this trend.</p>
        )}
      </CardContent>
    </Card>
  );
}
