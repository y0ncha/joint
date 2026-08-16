import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("recharts", () => ({
  CartesianGrid: () => <span data-grid="true" />,
  Legend: ({ content }: { content?: ReactNode }) =>
    isValidElement(content)
      ? cloneElement(content as ReactElement<{ payload: unknown[] }>, {
          payload: [
            { color: "var(--analytics-bill-1)", dataKey: "income" },
            { color: "var(--analytics-bill-11)", dataKey: "expenses" },
            { color: "var(--analytics-bill-15)", dataKey: "savings" },
            { color: "var(--color-muted-foreground)", dataKey: "savingsAverage" },
          ],
        })
      : null,
  Line: ({
    dataKey,
    stroke,
    strokeDasharray,
    strokeOpacity,
  }: {
    dataKey: string;
    stroke: string;
    strokeDasharray?: string;
    strokeOpacity?: number;
  }) => (
    <span
      data-line={dataKey}
      data-stroke={stroke}
      data-stroke-dasharray={strokeDasharray ?? "solid"}
      data-stroke-opacity={strokeOpacity ?? "1"}
    />
  ),
  LineChart: ({ accessibilityLayer, children, data }: { accessibilityLayer?: boolean; children: ReactNode; data: unknown[] }) => (
    <div data-accessibility-layer={accessibilityLayer} data-points={data.length}>
      {children}
    </div>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: () => <span data-tooltip="true" />,
  XAxis: () => <span data-axis="month" />,
  YAxis: () => <span data-axis="currency" />,
}));

import { DashboardMonthlyTrend } from "./dashboard-monthly-trend";

const data = [
  { month: "2026-02-01", income: 12_000, expenses: 8_000, savings: 4_000 },
  { month: "2026-03-01", income: 13_000, expenses: 9_000, savings: 4_000 },
  { month: "2026-04-01", income: 11_000, expenses: 10_000, savings: 1_000 },
  { month: "2026-05-01", income: 14_000, expenses: 9_500, savings: 4_500 },
  { month: "2026-06-01", income: 12_500, expenses: 11_000, savings: 1_500 },
  { month: "2026-07-01", income: 15_000, expenses: 10_000, savings: 5_000 },
];

it("renders an accessible detailed balance trend with a dashed rolling average", () => {
  const markup = renderToStaticMarkup(<DashboardMonthlyTrend data={data} />);

  expect(markup).toContain("Balance trend");
  expect(markup).not.toContain("xl:grid-cols");
  expect(markup).toContain('data-accessibility-layer="true"');
  expect(markup).toContain('data-points="6"');
  expect(markup).toContain('data-line="income"');
  expect(markup).toContain('data-line="expenses"');
  expect(markup).toContain('data-line="savings"');
  expect(markup).toContain('data-line="income" data-stroke="var(--color-income)" data-stroke-dasharray="solid"');
  expect(markup).toContain('data-line="expenses" data-stroke="var(--color-expenses)" data-stroke-dasharray="solid"');
  expect(markup).toContain('data-line="savings" data-stroke="var(--color-savings)" data-stroke-dasharray="solid"');
  expect(markup).toContain(
    'data-line="savingsAverage" data-stroke="var(--color-savingsAverage)" data-stroke-dasharray="4 4" data-stroke-opacity="0.55"',
  );
  expect(markup).toContain("--color-income: var(--analytics-bill-1)");
  expect(markup).toContain("--color-expenses: var(--analytics-bill-11)");
  expect(markup).toContain("--color-savings: var(--analytics-bill-15)");
  expect(markup).toContain("--color-savingsAverage: var(--color-muted-foreground)");
  expect(markup).toContain("Income");
  expect(markup).toContain("Outgoings");
  expect(markup).toContain("Monthly balance");
  expect(markup).toContain("Balance avg");
  expect(markup).toContain("₪3,667");
  expect(markup).toContain("Feb 2026");
  expect(markup).toContain("Jul 2026");
  expect(markup.indexOf("Jul 2026")).toBeLessThan(markup.indexOf("Feb 2026"));
  expect(markup).toContain("₪15,000");
  expect(markup).toContain("₪5,000");
  expect(markup).not.toContain("Six-month trend");
});
