import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("recharts", () => ({
  Bar: ({ dataKey, fill, stackId }: { dataKey: string; fill: string; stackId: string }) => (
    <span data-bar={dataKey} data-fill={fill} data-stack={stackId} />
  ),
  BarChart: ({ accessibilityLayer, children, data }: { accessibilityLayer?: boolean; children: ReactNode; data: unknown[] }) => (
    <div data-accessibility-layer={accessibilityLayer} data-points={data.length}>
      {children}
    </div>
  ),
  CartesianGrid: () => <span data-grid />,
  Legend: () => <span data-legend />,
  ReferenceLine: ({
    stroke,
    strokeDasharray,
    strokeOpacity,
    strokeWidth,
    y,
  }: {
    stroke: string;
    strokeDasharray: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    y: number;
  }) => (
    <span
      data-average={y}
      data-stroke={stroke}
      data-stroke-dasharray={strokeDasharray}
      data-stroke-opacity={strokeOpacity ?? "1"}
      data-stroke-width={strokeWidth ?? "1"}
    />
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: () => null,
  XAxis: () => <span data-axis="month" />,
  YAxis: () => <span data-axis="currency" />,
}));

import { GasTrendCard } from "./gas-trend-card";

it("renders six monthly Bike and Car stacked columns with an unlabelled dashed average reference", () => {
  const markup = renderToStaticMarkup(
    <GasTrendCard
      data={{
        average: 25,
        months: [
          { bike: 10, car: 20, month: "2026-03", previousBike: 5, previousCar: 10, previousTotal: 15, total: 30 },
          { bike: 0, car: 20, month: "2026-04", previousBike: 0, previousCar: 10, previousTotal: 10, total: 20 },
          { bike: 0, car: 0, month: "2026-05", previousBike: 0, previousCar: 0, previousTotal: 0, total: 0 },
          { bike: 60, car: 40, month: "2026-06", previousBike: 30, previousCar: 20, previousTotal: 50, total: 100 },
          { bike: 0, car: 0, month: "2026-07", previousBike: 0, previousCar: 0, previousTotal: 0, total: 0 },
          { bike: 0, car: 0, month: "2026-08", previousBike: 0, previousCar: 0, previousTotal: 0, total: 0 },
        ],
      }}
    />,
  );

  expect(markup).toContain("Gas trend");
  expect(markup).toContain("Bike and Car fuel compared with the previous year.");
  expect(markup).toContain('data-accessibility-layer="true"');
  expect(markup).toContain('data-points="6"');
  expect(markup).toContain('data-bar="bike"');
  expect(markup).toContain('data-bar="car"');
  expect(markup).toContain('data-bar="previousBike"');
  expect(markup).toContain('data-bar="previousCar"');
  expect(markup).toContain('data-stack="current"');
  expect(markup).toContain('data-stack="previous"');
  expect(markup).toContain('data-average="25"');
  expect(markup).toContain('data-stroke="var(--color-average)"');
  expect(markup).toContain('data-stroke-dasharray="4 4"');
  expect(markup).toContain('data-stroke-opacity="0.55"');
  expect(markup).toContain('data-stroke-width="2"');
  expect(markup).toContain("Bike");
  expect(markup).toContain("Car");
  expect(markup).not.toContain("Average monthly gas");
});

it("accepts the parent height class", () => {
  const markup = renderToStaticMarkup(<GasTrendCard className="flex-1" />);

  expect(markup).toContain("min-w-0 flex-1");
});

it("explains that either fuel subcategory enables the trend", () => {
  const markup = renderToStaticMarkup(<GasTrendCard />);

  expect(markup).toContain("Add an active Car or Bike fuel subcategory to see this trend.");
});
