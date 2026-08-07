import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeSelectChange: undefined as undefined | ((value: string) => void),
  alignBillYearOverYear: vi.fn(),
  billChanges: new Map<string, (checked: boolean) => void>(),
  historyPushState: vi.fn(),
  monthChange: undefined as undefined | ((event: { target: { value: string } }) => void),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
  selectChanges: new Map<string, (value: string) => void>(),
  showPopoverContent: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/bills-groceries",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/bills-groceries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bills-groceries")>();
  mocks.alignBillYearOverYear.mockImplementation(actual.alignBillYearOverYear);
  return { ...actual, alignBillYearOverYear: mocks.alignBillYearOverYear };
});
vi.mock("@/components/ui/input", () => ({
  Input: ({ "aria-label": ariaLabel, onChange }: { "aria-label"?: string; onChange?: (event: { target: { value: string } }) => void }) => {
    if (ariaLabel === "Select Groceries month") mocks.monthChange = onChange;
    return <input aria-label={ariaLabel} />;
  },
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, onCheckedChange }: { id: string; onCheckedChange: (checked: boolean) => void }) => {
    mocks.billChanges.set(id, onCheckedChange);
    return <input id={id} type="checkbox" />;
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (mocks.showPopoverContent ? <>{children}</> : null),
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
  SelectTrigger: ({ "aria-label": ariaLabel, children, id }: { "aria-label"?: string; children: ReactNode; id?: string }) => {
    const control = id ?? ariaLabel;
    if (control && mocks.activeSelectChange) mocks.selectChanges.set(control, mocks.activeSelectChange);
    return <>{children}</>;
  },
  SelectValue: () => null,
}));

import {
  BillsGroceriesChartDetail,
  BillsGroceriesDashboard,
  billsGroceriesChartIds,
  dashboardUrl,
  groceryTransactionsForDate,
  stackedBarRadius,
} from "./bills-groceries-dashboard";

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
};

const dashboardProps = { data: liveData as never, billIds: ["rent"], billId: "rent", period: "rolling" as const };

function detailTable(markup: string, label: string) {
  return markup.match(new RegExp(`<table[^>]*aria-label="${label} data table"[^>]*>([\\s\\S]*?)</table>`))?.[1] ?? "";
}

beforeEach(() => {
  mocks.activeSelectChange = undefined;
  mocks.alignBillYearOverYear.mockClear();
  mocks.billChanges.clear();
  mocks.historyPushState.mockReset();
  mocks.monthChange = undefined;
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

it("updates one dashboard URL field without losing unrelated canonical state", () => {
  const params = new URLSearchParams("period=rolling&bills=rent,water&bill=rent&groceryMonth=2026-07&source=household");

  expect(dashboardUrl("/bills-groceries", params, { period: "calendar" })).toBe(
    "/bills-groceries?period=calendar&bills=rent%2Cwater&bill=rent&groceryMonth=2026-07&source=household",
  );
  expect(
    dashboardUrl("/bills-groceries", params, {
      grocery: "main-run",
    }),
  ).toBe("/bills-groceries?period=rolling&bills=rent%2Cwater&bill=rent&groceryMonth=2026-07&source=household&grocery=main-run");
});

it("writes the selected daily month without losing dashboard filters", () => {
  mocks.searchParams = new URLSearchParams("period=calendar&bills=rent&bill=rent&groceryMonth=2026-07&grocery=top-ups");
  mocks.showPopoverContent = true;

  renderToStaticMarkup(<BillsGroceriesDashboard data={liveData as never} billIds={["rent"]} billId="rent" period="calendar" />);
  mocks.monthChange?.({ target: { value: "2026-06" } });

  expect(mocks.push).toHaveBeenCalledWith("/bills-groceries?period=calendar&bills=rent&bill=rent&groceryMonth=2026-06&grocery=top-ups");
});

it("uses router navigation only for data-bearing dashboard filters", () => {
  mocks.searchParams = new URLSearchParams("period=rolling&bills=rent&bill=rent&groceryMonth=2026-07&grocery=main-run");
  mocks.showPopoverContent = true;
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
    },
  };

  renderToStaticMarkup(<BillsGroceriesDashboard data={data as never} billIds={["rent"]} billId="rent" period="rolling" />);

  mocks.selectChanges.get("Bills by month-period")?.("calendar");
  mocks.selectChanges.get("Year-over-year-period")?.("calendar");
  mocks.selectChanges.get("Groceries by month-period")?.("calendar");
  mocks.billChanges.get("bills-water")?.(true);
  mocks.selectChanges.get("year-over-year-bill")?.("water");
  mocks.selectChanges.get("Show spending")?.("top-ups");

  expect(mocks.push).toHaveBeenNthCalledWith(
    1,
    "/bills-groceries?period=calendar&bills=rent&bill=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.push).toHaveBeenNthCalledWith(
    2,
    "/bills-groceries?period=calendar&bills=rent&bill=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.push).toHaveBeenNthCalledWith(
    3,
    "/bills-groceries?period=calendar&bills=rent&bill=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.push).toHaveBeenCalledTimes(3);
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    1,
    null,
    "",
    "/bills-groceries?period=rolling&bills=rent%2Cwater&bill=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    2,
    null,
    "",
    "/bills-groceries?period=rolling&bills=rent&bill=water&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.historyPushState).toHaveBeenNthCalledWith(
    3,
    null,
    "",
    "/bills-groceries?period=rolling&bills=rent&bill=rent&groceryMonth=2026-07&grocery=top-ups",
  );
  expect(mocks.historyPushState).toHaveBeenCalledTimes(3);
});

it("renders valid Bills selections and the year-over-year Bill from synchronized URL state", () => {
  mocks.searchParams = new URLSearchParams("period=rolling&bills=water&bill=water&groceryMonth=2026-07");
  const data = {
    ...liveData,
    bills: {
      ...liveData.bills,
      subcategories: [...liveData.bills.subcategories, { id: "water", name: "Water", color: "#234567" }],
      monthly: [...liveData.bills.monthly, { month: "2026-07", subcategoryId: "water", agorot: 6_789 }],
    },
  };

  const billsMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="bills" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );
  const yearOverYearMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="year-over-year" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );

  expect(billsMarkup).toContain(">Water</th>");
  expect(billsMarkup).not.toContain(">Rent</th>");
  expect(mocks.alignBillYearOverYear).toHaveBeenLastCalledWith(data.months, data.bills.monthly, "water");
  expect(yearOverYearMarkup).toContain('aria-label="Water year-over-year chart');
});

it("links every dashboard chart to the detail route for its exported ID", () => {
  mocks.searchParams = new URLSearchParams("period=calendar&bill=rent");
  const markup = renderToStaticMarkup(<BillsGroceriesDashboard {...dashboardProps} />);

  for (const id of billsGroceriesChartIds) {
    expect(markup).toContain(`href="/bills-groceries/${id}?period=calendar&amp;bill=rent"`);
  }
  expect(markup).not.toContain('href="/bills-groceries/yoy"');
});

it("renders only the requested chart and its table on a detail page", () => {
  const markup = renderToStaticMarkup(<BillsGroceriesChartDetail chart="daily" {...dashboardProps} />);

  expect(markup).toContain("Groceries by day");
  expect(markup).toContain('aria-label="Groceries by day data table"');
  expect(markup).toContain("Cumulative total");
  expect(markup).toContain('aria-label="Back to Bills &amp; Groceries"');
  expect(markup).not.toContain(">Back to Bills &amp; Groceries<");
  expect(markup).not.toContain("Open Groceries by day details");
  expect(markup).not.toContain("Bills by month");
  expect(markup).not.toContain("Year-over-year");
  expect(markup).not.toContain("Groceries by month");
});

it("keeps chart data tables out of the default card view", () => {
  const markup = renderToStaticMarkup(<BillsGroceriesDashboard {...dashboardProps} />);

  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Groceries by day"]) {
    expect(markup).toContain(title);
    expect(markup).not.toContain(`aria-label="${title} data table"`);
  }

  expect(markup.indexOf("Bills by month")).toBeLessThan(markup.indexOf("Year-over-year"));
  expect(markup.indexOf("Year-over-year")).toBeLessThan(markup.indexOf("Groceries by month"));
  expect(markup.indexOf("Groceries by month")).toBeLessThan(markup.indexOf("Groceries by day"));
  expect(markup).not.toContain('aria-label="Bills & Groceries controls"');
  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Groceries by day"]) {
    expect(markup).toContain(`aria-label="Configure ${title}"`);
    expect(markup).toContain(`aria-label="Open ${title} details"`);
  }
  expect(markup).toContain('aria-label="Open Groceries by day details"');
  expect(markup).not.toContain('aria-label="Choose Bills subcategories"');
  expect(markup).not.toContain('aria-label="Select year-over-year Bill"');
  expect(markup).not.toContain("Budget ₪2,200.00");
  expect(markup).not.toContain("fixture values");
  expect(markup).not.toContain("Daily total");
  expect(markup).toContain("use arrow keys to inspect values");
  expect(markup).not.toContain('data-slot="collapsible"');
});

it("renders Groceries by day as a total-spend heatmap", () => {
  const markup = renderToStaticMarkup(<BillsGroceriesDashboard {...dashboardProps} />);

  expect(markup).toContain('aria-label="Groceries by day heatmap"');
  expect(markup).toContain("Total daily spending");
  expect(markup.match(/role="row"/g)).toHaveLength(6);
  expect(markup).not.toContain("Stacked daily groceries chart");
});

it("renders live colors, missing-data guidance, and exact daily values", () => {
  const markup = renderToStaticMarkup(
    <BillsGroceriesDashboard data={liveData as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );

  expect(markup).toContain("#234567");
  expect(markup).toContain("#345678");
  expect(markup).toContain("#654321");
  expect(markup).toContain("No previous-year data");
  expect(markup).toContain("Set a monthly groceries budget in Settings.");
  expect(markup).toContain("2026-07-01: ₪0.00");
  expect(markup).toContain("2026-07-02: ₪168.00");
});

it("uses a contrast-safe backing behind day labels on stored heatmap colors", () => {
  const markup = renderToStaticMarkup(
    <BillsGroceriesDashboard
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
      billId="rent"
      period="rolling"
    />,
  );

  expect(markup).toContain("bg-background/85");
});

it("renders the Bills empty state instead of a missing-prior-year notice when no Bills values exist", () => {
  const data = {
    ...liveData,
    bills: { ...liveData.bills, monthly: [] },
  } as never;
  const markup = renderToStaticMarkup(<BillsGroceriesDashboard data={data} billIds={["rent"]} billId="rent" period="rolling" />);

  expect(markup.match(/No Bills data yet\./g)).toHaveLength(2);
  expect(markup).not.toContain("No previous-year data");
  const detailMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="bills" data={data} billIds={["rent"]} billId="rent" period="rolling" />,
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
    <BillsGroceriesChartDetail
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
      billId="water"
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
  expect(markup.match(/No previous-year data/g)).toHaveLength(2);
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
    <BillsGroceriesChartDetail chart="bills" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );
  const yearOverYearMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="year-over-year" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );
  const groceriesMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="groceries" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
  );
  const dailyMarkup = renderToStaticMarkup(
    <BillsGroceriesChartDetail chart="daily" data={data as never} billIds={["rent"]} billId="rent" period="rolling" />,
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

it("includes the configured budget in the equivalent monthly Groceries table", () => {
  const markup = renderToStaticMarkup(
    <BillsGroceriesChartDetail
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
      billId="rent"
      period="rolling"
    />,
  );

  expect(markup).toContain("Monthly budget");
  expect(markup).toContain("₪2,000.00");
});
