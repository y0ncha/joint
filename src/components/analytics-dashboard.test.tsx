import type { ReactNode } from "react";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeSelectChange: undefined as undefined | ((value: string) => void),
  alignBillYearOverYear: vi.fn(),
  billChanges: new Map<string, (checked: boolean) => void>(),
  billContextMenus: new Map<string, (event: { preventDefault: () => void }) => void>(),
  historyPushState: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
  selectChanges: new Map<string, (value: string) => void>(),
  showPopoverContent: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/analytics",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    Bar: ({ dataKey, fillOpacity, stackId }: { dataKey: string; fillOpacity?: number; stackId?: string }) => (
      <span data-bar={dataKey} data-stack={stackId} data-opacity={fillOpacity ?? 1} />
    ),
    BarChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => (
      <div data-chart-data={JSON.stringify(data)}>{children}</div>
    ),
    CartesianGrid: () => null,
    Cell: () => null,
    Legend: ({ content, height }: { content?: ReactNode; height?: number }) => (
      <span
        data-legend={
          isValidElement<{ className?: string }>(content) && content.props.className?.includes("grid-cols-5") ? "bills" : "year-over-year"
        }
        data-legend-class={isValidElement<{ className?: string }>(content) ? content.props.className : undefined}
        data-legend-height={height}
      />
    ),
    Line: ({ dataKey, strokeDasharray, strokeOpacity }: { dataKey: string; strokeDasharray?: string; strokeOpacity?: number }) => (
      <span data-line={dataKey} data-stroke-dasharray={strokeDasharray ?? "solid"} data-stroke-opacity={strokeOpacity ?? "1"} />
    ),
    ReferenceLine: ({
      label,
      strokeDasharray,
      strokeOpacity,
      strokeWidth,
      y,
    }: {
      label?: string;
      strokeDasharray?: string;
      strokeOpacity?: number;
      strokeWidth?: number;
      y: number;
    }) => (
      <span
        data-budget-line={label ? undefined : y}
        data-reference-line={y}
        data-reference-label={label}
        data-stroke-dasharray={strokeDasharray}
        data-reference-opacity={strokeOpacity ?? "1"}
        data-reference-width={strokeWidth ?? "1"}
      />
    ),
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  mocks.alignBillYearOverYear.mockImplementation(actual.alignBillYearOverYear);
  return { ...actual, alignBillYearOverYear: mocks.alignBillYearOverYear };
});
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, onCheckedChange }: { id: string; onCheckedChange: (checked: boolean) => void }) => {
    mocks.billChanges.set(id, onCheckedChange);
    return <input id={id} type="checkbox" />;
  },
}));
vi.mock("@/components/ui/field", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/field")>();
  return {
    ...actual,
    Field: ({ id, onContextMenu, ...props }: React.ComponentProps<typeof actual.Field>) => {
      if (id?.startsWith("bills-option-") && onContextMenu) {
        mocks.billContextMenus.set(id, onContextMenu as (event: { preventDefault: () => void }) => void);
      }
      return <actual.Field id={id} onContextMenu={onContextMenu} {...props} />;
    },
  };
});
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ align, children, className, side }: { align?: string; children: ReactNode; className?: string; side?: string }) =>
    mocks.showPopoverContent ? (
      <div className={className} data-align={align} data-side={side}>
        {children}
      </div>
    ) : null,
  PopoverHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange: (value: string) => void; value: string }) => {
    void value;
    mocks.activeSelectChange = onValueChange;
    return <>{children}</>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: ({
    "aria-label": ariaLabel,
    children,
    className,
    id,
  }: {
    "aria-label"?: string;
    children: ReactNode;
    className?: string;
    id?: string;
  }) => {
    const control = id ?? ariaLabel;
    if (control && mocks.activeSelectChange) mocks.selectChanges.set(control, mocks.activeSelectChange);
    return (
      <button aria-label={ariaLabel} className={className}>
        {children}
      </button>
    );
  },
  SelectValue: () => null,
}));

import {
  AnalyticsChartDetail,
  AnalyticsDashboard,
  analyticsChartIds,
  dailyHeatmapLevel,
  groceryTransactionsForDate,
  stackedBarRadius,
} from "./analytics-dashboard";

const liveData = {
  months: ["2026-07"],
  bills: {
    category: { id: "bills", name: "Bills", color: "#111111" },
    subcategories: [{ id: "rent", name: "Rent", color: "#123456" }],
    monthly: [{ month: "2026-07", subcategoryId: "rent", agorot: 12_345 }],
    defaultSubcategoryId: "rent",
  },
  groceries: {
    category: { id: "groceries", name: "Groceries", color: "#654321" },
    subcategories: {
      mainRun: { id: "main", name: "Main run", color: "#234567" },
      topUps: { id: "top-ups", name: "Top-ups", color: "#345678" },
    },
    monthly: {
      budgetAgorot: null,
      months: [{ month: "2026-07", mainRunAgorot: 45_600, topUpsAgorot: 7_800 }],
    },
    daily: Array.from({ length: 31 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const mainRunAgorot = index === 1 ? 12_300 : 0;
      const topUpsAgorot = index === 1 ? 4_500 : 0;
      return { date: `2026-07-${day}`, mainRunAgorot, topUpsAgorot, totalAgorot: mainRunAgorot + topUpsAgorot };
    }),
    transactions: [
      {
        id: "grocery-1",
        amount: 123,
        merchant: "Market",
        note: "Weekly shop",
        occurredOn: "2026-07-02",
        subcategoryKey: "main_run" as const,
      },
      { id: "grocery-2", amount: 45, merchant: "Corner shop", note: "Milk", occurredOn: "2026-07-02", subcategoryKey: "top_ups" as const },
    ],
  },
  gas: {
    average: 30,
    months: [
      {
        bike: 10,
        car: 20,
        month: "2026-07",
        previousBike: 5,
        previousCar: 15,
        previousTotal: 20,
        total: 30,
      },
    ],
  },
};

const dashboardProps = {
  data: liveData as never,
  billIds: ["rent"],
  yoy: "rent",
  period: "rolling" as const,
};

function detailTable(markup: string, label: string) {
  return markup.match(new RegExp(`<table[^>]*aria-label="${label} data table"[^>]*>([\\s\\S]*?)</table>`))?.[1] ?? "";
}

beforeEach(() => {
  mocks.activeSelectChange = undefined;
  mocks.alignBillYearOverYear.mockClear();
  mocks.billChanges.clear();
  mocks.billContextMenus.clear();
  mocks.historyPushState.mockReset();
  mocks.push.mockReset();
  mocks.searchParams = new URLSearchParams();
  mocks.selectChanges.clear();
  mocks.showPopoverContent = false;
  vi.stubGlobal("window", { history: { pushState: mocks.historyPushState } });
});

it("keeps the day dialog aligned with the active groceries filter", () => {
  const transactions = liveData.groceries.transactions;

  expect(groceryTransactionsForDate(transactions, "2026-07-02", "main-run").map((transaction) => transaction.id)).toEqual(["grocery-1"]);
  expect(groceryTransactionsForDate(transactions, "2026-07-02", "top-ups").map((transaction) => transaction.id)).toEqual(["grocery-2"]);
  expect(groceryTransactionsForDate(transactions, "2026-07-02", "all").map((transaction) => transaction.id)).toEqual([
    "grocery-1",
    "grocery-2",
  ]);
});

it("rounds only the visible top segment of a stack", () => {
  expect(stackedBarRadius([380, 0], 0)).toEqual([3, 3, 0, 0]);
  expect(stackedBarRadius([380, 60], 0)).toBe(0);
  expect(stackedBarRadius([380, 60], 1)).toEqual([3, 3, 0, 0]);
});

it("uses a fixed 700 ILS ceiling for daily heatmap intensity", () => {
  expect(dailyHeatmapLevel(0)).toBe(0);
  expect(dailyHeatmapLevel(175)).toBe(1);
  expect(dailyHeatmapLevel(350)).toBe(2);
  expect(dailyHeatmapLevel(525)).toBe(3);
  expect(dailyHeatmapLevel(700)).toBe(4);
  expect(dailyHeatmapLevel(900)).toBe(4);
});

it("writes the separately selected daily year and month without losing dashboard filters", () => {
  mocks.searchParams = new URLSearchParams("period=calendar&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=top-ups");
  mocks.showPopoverContent = true;

  const markup = renderToStaticMarkup(
    <AnalyticsDashboard
      data={{ ...liveData, months: ["2025-09", "2025-10", "2026-06", "2026-07"] } as never}
      billIds={["rent"]}
      yoy="rent"
      period="calendar"
    />,
  );
  mocks.selectChanges.get("groceries-year")?.("2025");
  mocks.selectChanges.get("groceries-month")?.("10");

  expect(markup).toContain('for="groceries-year"');
  expect(markup).toContain('for="groceries-month"');
  expect(markup).toContain("2025");
  expect(markup).toContain("July");
  expect(mocks.push).toHaveBeenNthCalledWith(1, "/analytics?period=calendar&bills=rent&yoy=rent&groceryMonth=2025-09&grocery=top-ups");
  expect(mocks.push).toHaveBeenNthCalledWith(2, "/analytics?period=calendar&bills=rent&yoy=rent&groceryMonth=2026-10&grocery=top-ups");
});

it("anchors Groceries day details to their selected cell", () => {
  mocks.showPopoverContent = true;

  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);

  expect(markup).toContain('data-side="right"');
  expect(markup).toContain('data-align="start"');
  expect(markup).toContain('class="w-72 p-4"');
});

it("renders separate year and month selectors for Groceries by day", () => {
  mocks.showPopoverContent = true;

  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);
  const yearControl = markup.match(/<button[^>]*aria-label="Select Groceries year"[^>]*>/)?.[0] ?? "";
  const monthControl = markup.match(/<button[^>]*aria-label="Select Groceries month"[^>]*>/)?.[0] ?? "";
  const spendingControl = markup.match(/<button[^>]*aria-label="Show spending"[^>]*>/)?.[0] ?? "";

  expect(yearControl).toContain("min-h-11 w-full");
  expect(monthControl).toContain("min-h-11 w-full");
  expect(spendingControl).toContain("min-h-11 w-full");
});

it("uses router navigation only for data-bearing dashboard filters", () => {
  mocks.searchParams = new URLSearchParams("period=rolling&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=main-run");
  mocks.showPopoverContent = true;
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
    },
  };

  renderToStaticMarkup(<AnalyticsDashboard data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />);

  mocks.selectChanges.get("Bills by month-period")?.("calendar");
  mocks.selectChanges.get("Year-over-year-period")?.("calendar");
  mocks.selectChanges.get("Groceries by month-period")?.("calendar");
  mocks.billChanges.get("bills-water")?.(true);
  mocks.selectChanges.get("year-over-year-series")?.("water");
  mocks.selectChanges.get("groceries-spending")?.("top-ups");

  expect(mocks.push).toHaveBeenNthCalledWith(1, "/analytics?period=calendar&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=main-run");
  expect(mocks.push).toHaveBeenNthCalledWith(2, "/analytics?period=calendar&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=main-run");
  expect(mocks.push).toHaveBeenNthCalledWith(3, "/analytics?period=calendar&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=main-run");
  expect(mocks.push).toHaveBeenCalledTimes(3);
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    1,
    null,
    "",
    "/analytics?period=rolling&bills=rent%2Cwater&yoy=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    2,
    null,
    "",
    "/analytics?period=rolling&bills=rent&yoy=water&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    3,
    null,
    "",
    "/analytics?period=rolling&bills=rent&yoy=rent&groceryMonth=2026-07&grocery=top-ups",
  );
  expect(mocks.historyPushState).toHaveBeenCalledTimes(3);
});

it("uses a searchable Bills multiselect and right-click selects only that Bill", () => {
  mocks.searchParams = new URLSearchParams("bills=rent,water&yoy=rent");
  mocks.showPopoverContent = true;
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [
        ...liveData.bills.subcategories,
        { id: "water", name: "Water", color: "#234567" },
        { id: "cables", name: "Cables", color: "#345678" },
      ],
    },
  };

  const markup = renderToStaticMarkup(<AnalyticsDashboard data={data as never} billIds={["rent", "water"]} yoy="rent" period="rolling" />);
  const preventDefault = vi.fn();
  mocks.billContextMenus.get("bills-option-water")?.({ preventDefault });

  expect(markup).toContain("2 Bills selected");
  expect(markup).toContain('aria-label="Search Bills"');
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(mocks.historyPushState).toHaveBeenCalledWith(null, "", "/analytics?bills=water&yoy=rent");
});

it("renders valid Bills selections and the year-over-year Bill from synchronized URL state", () => {
  mocks.searchParams = new URLSearchParams("period=rolling&bills=water&yoy=water&groceryMonth=2026-07");
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
      monthly: [...liveData.bills.monthly, { month: "2026-07", subcategoryId: "water", agorot: 6_789 }],
    },
  };

  const billsMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="bills" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  const yearOverYearMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="year-over-year" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );

  expect(billsMarkup).toContain(">Water</th>");
  expect(billsMarkup).not.toContain(">Rent</th>");
  expect(mocks.alignBillYearOverYear).toHaveBeenLastCalledWith(data.months, data.bills.monthly, "water");
  expect(yearOverYearMarkup).toContain('aria-label="Water year-over-year chart');
});

it("renders Gas as current and previous Bike/Car stacks with a tabular equivalent", () => {
  mocks.searchParams = new URLSearchParams("yoy=gas");

  const markup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="year-over-year" data={liveData as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );

  expect(markup).toContain('aria-label="Gas year-over-year chart');
  expect(markup).toContain('data-bar="previousBike" data-stack="previous" data-opacity="0.38"');
  expect(markup).toContain('data-bar="previousCar" data-stack="previous" data-opacity="0.38"');
  expect(markup).toContain('data-bar="bike" data-stack="current"');
  expect(markup).toContain('data-bar="car" data-stack="current"');
  expect(markup).toContain("Current Bike");
  expect(markup).toContain("Previous Car");
  expect(markup).toContain("₪30.00");
});

it("re-derives presentation state when browser history supplies different search parameters", () => {
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
      monthly: [...liveData.bills.monthly, { month: "2026-07", subcategoryId: "water", agorot: 6_789 }],
    },
  };
  mocks.searchParams = new URLSearchParams("bills=water&yoy=water&grocery=top-ups");
  const forwardMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="year-over-year" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  mocks.searchParams = new URLSearchParams("bills=rent&yoy=rent&grocery=main-run");
  const backMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="year-over-year" data={data as never} billIds={["water"]} yoy="water" period="rolling" />,
  );

  expect(forwardMarkup).toContain('aria-label="Water year-over-year chart');
  expect(backMarkup).toContain('aria-label="Rent year-over-year chart');
  expect(mocks.push).not.toHaveBeenCalled();
});

it("links every dashboard chart to the detail route for its exported ID", () => {
  mocks.searchParams = new URLSearchParams("period=calendar&yoy=rent");
  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);

  for (const id of analyticsChartIds) {
    expect(markup).toContain(`href="/analytics/${id}?period=calendar&amp;yoy=rent"`);
  }
  expect(markup).not.toContain('href="/analytics/yoy"');
});

it("gives Year-over-year the full desktop row", () => {
  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);
  const card = markup.match(/<div[^>]*data-chart-card="year-over-year"[^>]*>/)?.[0] ?? "";

  expect(card).toContain("xl:col-span-2");
});

it("renders only the requested chart and its table on a detail page", () => {
  const markup = renderToStaticMarkup(<AnalyticsChartDetail chart="daily" {...dashboardProps} />);

  expect(markup).toContain("Groceries by day");
  expect(markup).toContain('aria-label="Groceries by day data table"');
  expect(markup).toContain("Cumulative total");
  expect(markup).toContain('aria-label="Back to Analytics"');
  expect(markup).not.toContain(">Back to Analytics<");
  expect(markup).not.toContain("Open Groceries by day details");
  expect(markup).not.toContain("Bills by month");
  expect(markup).not.toContain("Year-over-year");
  expect(markup).not.toContain("Groceries by month");
});

it("keeps chart data tables out of the default card view", () => {
  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);

  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Groceries by day"]) {
    expect(markup).toContain(title);
    expect(markup).not.toContain(`aria-label="${title} data table"`);
  }

  expect(markup.indexOf("Bills by month")).toBeLessThan(markup.indexOf("Year-over-year"));
  expect(markup.indexOf("Year-over-year")).toBeLessThan(markup.indexOf("Groceries by month"));
  expect(markup.indexOf("Groceries by month")).toBeLessThan(markup.indexOf("Groceries by day"));
  expect(markup).not.toContain('aria-label="Analytics controls"');
  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Groceries by day"]) {
    expect(markup).toContain(`aria-label="Configure ${title}"`);
    expect(markup).toContain(`aria-label="Open ${title} details"`);
  }
  expect(markup).toContain('aria-label="Open Groceries by day details"');
  expect(markup).not.toContain('aria-label="Choose Bills subcategories"');
  expect(markup).not.toContain("Budget ₪2,200.00");
  expect(markup).not.toContain("fixture values");
  expect(markup).not.toContain("Daily total");
  expect(markup).toContain("use arrow keys to inspect values");
  expect(markup).not.toContain('data-slot="collapsible"');
});

it("renders Groceries by day as a total-spend heatmap", () => {
  const markup = renderToStaticMarkup(<AnalyticsDashboard {...dashboardProps} />);

  expect(markup).toContain('aria-label="Groceries by day heatmap"');
  expect(markup).toContain("Total daily spending");
  expect(markup.match(/role="row"/g)).toHaveLength(6);
  expect(markup).not.toContain("Stacked daily groceries chart");
});

it("renders the analytics palette, missing-data guidance, and exact daily values", () => {
  const markup = renderToStaticMarkup(<AnalyticsDashboard data={liveData as never} billIds={["rent"]} yoy="rent" period="rolling" />);

  expect(markup).toContain("--color-mainRun: var(--analytics-groceries-main-run)");
  expect(markup).toContain("--color-topUps: var(--analytics-groceries-top-ups)");
  expect(markup).toContain("--color-current: var(--analytics-year-over-year-current)");
  expect(markup).toContain("--color-previous: var(--analytics-year-over-year-previous)");
  expect(markup).toContain("color-mix(in oklab, var(--analytics-groceries-heatmap) 25%, transparent)");
  expect(markup).toContain("var(--analytics-bill-1)");
  expect(markup).not.toContain("No previous-year data");
  expect(markup).not.toContain("monthly budget");
  expect(markup).toContain("2026-07-01: ₪0.00");
  expect(markup).toContain("2026-07-02: ₪168.00");
});

it("keeps Bills stacks and their equivalent table in stable chart order", () => {
  mocks.searchParams = new URLSearchParams("bills=water,rent&yoy=rent");
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
      monthly: [...liveData.bills.monthly, { month: "2026-07", subcategoryId: "water", agorot: 6_789 }],
    },
  };

  const markup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="bills" data={data as never} billIds={["rent", "water"]} yoy="rent" period="rolling" />,
  );
  const table = detailTable(markup, "Bills by month");

  expect(table.indexOf(">Rent</th>")).toBeLessThan(table.indexOf(">Water</th>"));
});

it("caps Bills charts at the standard card height when the legend has two rows", () => {
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: Array.from({ length: 9 }, (_, index) => ({ id: `bill-${index}`, name: `Bill ${index}`, color: "#d9f0fa" })),
    },
  } as never;

  const markup = renderToStaticMarkup(
    <AnalyticsDashboard data={data} billIds={Array.from({ length: 9 }, (_, index) => `bill-${index}`)} yoy="bill-0" period="rolling" />,
  );

  expect(markup).toContain('data-legend-class="grid w-full grid-cols-5');
  expect(markup).toContain('data-legend-height="68"');
  expect(markup).toContain("h-[295px] md:hidden");
  expect(markup).toContain("hidden md:flex md:h-[calc(295px+var(--bills-legend-height))]");
  expect(markup).toContain("--bills-legend-height:68px");

  for (const color of [
    "var(--analytics-bill-1)",
    "var(--analytics-bill-2)",
    "var(--analytics-bill-3)",
    "var(--analytics-bill-4)",
    "var(--analytics-bill-5)",
    "var(--analytics-bill-6)",
    "var(--analytics-bill-7)",
    "var(--analytics-bill-8)",
    "var(--analytics-bill-9)",
  ]) {
    expect(markup).toContain(color);
  }
});

it("keeps both desktop legends within the capped Bills chart", () => {
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: Array.from({ length: 11 }, (_, index) => ({ id: `bill-${index}`, name: `Bill ${index}`, color: "#d9f0fa" })),
    },
  } as never;

  const markup = renderToStaticMarkup(
    <AnalyticsDashboard data={data} billIds={Array.from({ length: 11 }, (_, index) => `bill-${index}`)} yoy="bill-0" period="rolling" />,
  );

  expect(markup.match(/data-legend=/g)).toHaveLength(3);
  expect(markup).toContain('data-legend="bills"');
  expect(markup).toContain('data-legend="year-over-year"');
  expect(markup).toContain('data-legend-class="grid w-full grid-cols-5');
  expect(markup).toContain('data-legend-height="96"');
  expect(markup).toContain("h-[295px] md:hidden");
  expect(markup).toContain("hidden md:flex md:h-[calc(295px+var(--bills-legend-height))]");
  expect(markup).toContain("--bills-legend-height:96px");
});

it("uses the Groceries analytics heatmap palette with white active-day labels and light idle cells", () => {
  const markup = renderToStaticMarkup(
    <AnalyticsDashboard
      data={
        {
          ...liveData,
          groceries: {
            ...liveData.groceries,
            category: { ...liveData.groceries.category, color: "#ccebef" },
          },
        } as never
      }
      billIds={["rent"]}
      yoy="rent"
      period="rolling"
    />,
  );

  expect(markup).toContain("color-mix(in oklab, var(--analytics-groceries-heatmap) 25%, transparent)");
  expect(markup).toContain("text-white");
  expect(markup).toContain("bg-card text-muted-foreground");
});

it("renders the Bills empty state instead of a missing-prior-year notice when no Bills values exist", () => {
  const data = {
    ...liveData,
    bills: { ...liveData.bills, monthly: [] },
  } as never;
  const markup = renderToStaticMarkup(<AnalyticsDashboard data={data} billIds={["rent"]} yoy="rent" period="rolling" />);

  expect(markup.match(/No Bills data yet\./g)).toHaveLength(2);
  expect(markup).not.toContain("No previous-year data");
  const detailMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="bills" data={data} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  expect(detailMarkup).toContain("No Bills data yet.");
  expect(detailMarkup).not.toContain('aria-label="Bills by month data table"');
});

it("renders the selected Bill's aligned year-over-year agorot values and missing prior year", () => {
  mocks.alignBillYearOverYear.mockReturnValueOnce([
    { month: "2026-07", currentAgorot: 12_345, previousAgorot: 6_789 },
    { month: "2026-08", currentAgorot: 2_500 },
  ]);

  const markup = renderToStaticMarkup(
    <AnalyticsChartDetail
      chart="year-over-year"
      data={
        {
          ...liveData,
          months: ["2026-07", "2026-08"],
          bills: {
            ...liveData.bills,
            subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
            monthly: [{ month: "2026-07", subcategoryId: "water", agorot: 1 }],
          },
        } as never
      }
      billIds={["rent"]}
      yoy="water"
      period="rolling"
    />,
  );

  expect(mocks.alignBillYearOverYear).toHaveBeenCalledWith(
    ["2026-07", "2026-08"],
    [{ month: "2026-07", subcategoryId: "water", agorot: 1 }],
    "water",
  );
  expect(markup).toContain("₪123.45");
  expect(markup).toContain("₪67.89");
  expect(markup).toContain("₪25.00");
  expect(markup.match(/No previous-year data/g)).toHaveLength(1);
});

it("omits zero-spend rows from analytics detail tables", () => {
  const data = {
    ...liveData,
    months: ["2026-06", "2026-07"],
    groceries: {
      ...liveData.groceries,
      monthly: {
        ...liveData.groceries.monthly,
        months: [{ month: "2026-06", mainRunAgorot: 0, topUpsAgorot: 0 }, ...liveData.groceries.monthly.months],
      },
    },
  };
  const billsMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="bills" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  const yearOverYearMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="year-over-year" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  const groceriesMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="groceries" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );
  const dailyMarkup = renderToStaticMarkup(
    <AnalyticsChartDetail chart="daily" data={data as never} billIds={["rent"]} yoy="rent" period="rolling" />,
  );

  for (const [markup, label, omitted, retained] of [
    [billsMarkup, "Bills by month", "2026-06", "2026-07"],
    [yearOverYearMarkup, "Year-over-year", "2026-06", "2026-07"],
    [groceriesMarkup, "Groceries by month", "2026-06", "2026-07"],
    [dailyMarkup, "Groceries by day", "2026-07-01", "2026-07-02"],
  ]) {
    expect(detailTable(markup, label)).not.toContain(omitted);
    expect(detailTable(markup, label)).toContain(retained);
  }
  expect(detailTable(dailyMarkup, "Groceries by day")).toContain("₪168.00");
});

it("renders the configured Groceries budget as a hoverable line", () => {
  const markup = renderToStaticMarkup(
    <AnalyticsChartDetail
      chart="groceries"
      data={
        {
          ...liveData,
          groceries: {
            ...liveData.groceries,
            monthly: { ...liveData.groceries.monthly, budgetAgorot: 200_000 },
          },
        } as never
      }
      billIds={["rent"]}
      yoy="rent"
      period="rolling"
    />,
  );

  expect(markup).toContain("--color-budget: var(--color-muted-foreground)");
  expect(markup).toContain('data-line="budget" data-stroke-dasharray="4 4" data-stroke-opacity="0.55"');
  expect(markup).toContain("&quot;budget&quot;:2000");
});

it("renders Bills and YoY averages as straight, hoverable lines", () => {
  mocks.alignBillYearOverYear.mockReturnValueOnce([
    { month: "2026-05", currentAgorot: 10_000, previousAgorot: 5_000 },
    { month: "2026-06", currentAgorot: 20_000, previousAgorot: 5_000 },
    { month: "2026-07", currentAgorot: 30_000, previousAgorot: 5_000 },
  ]);
  const data = {
    ...liveData,
    months: ["2026-05", "2026-06", "2026-07"],
    bills: {
      ...liveData.bills,
      monthly: [
        { month: "2026-05", subcategoryId: "rent", agorot: 10_000 },
        { month: "2026-06", subcategoryId: "rent", agorot: 20_000 },
        { month: "2026-07", subcategoryId: "rent", agorot: 30_000 },
      ],
    },
  } as never;

  const markup = renderToStaticMarkup(<AnalyticsDashboard data={data} billIds={["rent"]} yoy="rent" period="rolling" />);

  expect(markup).not.toContain("data-reference-line");
  expect(markup).toContain('data-stroke-dasharray="4 4"');
  expect(markup).toContain('data-line="average" data-stroke-dasharray="4 4" data-stroke-opacity="0.55"');
  expect(markup).toContain('data-line="currentAverage" data-stroke-dasharray="4 4" data-stroke-opacity="0.55"');
  expect(markup).toContain("&quot;currentAverage&quot;:200");
});
