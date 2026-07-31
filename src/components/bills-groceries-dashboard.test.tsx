import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeSelectChange: undefined as undefined | ((value: string) => void),
  billChanges: new Map<string, (checked: boolean) => void>(),
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

import { BillsGroceriesChartDetail, BillsGroceriesDashboard, dashboardUrl, stackedBarRadius } from "./bills-groceries-dashboard";
import { TooltipProvider } from "./ui/tooltip";

const liveData = {
  months: ["2026-07"],
  bills: {
    category: { id: "bills", name: "Bills", color: "#111111" },
    subcategories: [{ id: "rent", name: "Rent", color: "#123456" }],
    monthly: [{ month: "2026-07", subcategoryId: "rent", agorot: 12_345 }],
    defaultSubcategoryId: "rent",
    yearOverYear: [{ month: "2026-07", currentAgorot: 12_345 }],
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
  },
};

const dashboardProps = { data: liveData as never, billIds: ["rent"], billId: "rent", period: "rolling" as const };

beforeEach(() => {
  mocks.activeSelectChange = undefined;
  mocks.billChanges.clear();
  mocks.monthChange = undefined;
  mocks.push.mockReset();
  mocks.searchParams = new URLSearchParams();
  mocks.selectChanges.clear();
  mocks.showPopoverContent = false;
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

it("writes each configured dashboard filter through its URL handler", () => {
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
  mocks.selectChanges.get("yoy-bill")?.("water");
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
  expect(mocks.push).toHaveBeenNthCalledWith(
    4,
    "/bills-groceries?period=rolling&bills=rent%2Cwater&bill=rent&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.push).toHaveBeenNthCalledWith(
    5,
    "/bills-groceries?period=rolling&bills=rent&bill=water&groceryMonth=2026-07&grocery=main-run",
  );
  expect(mocks.push).toHaveBeenNthCalledWith(
    6,
    "/bills-groceries?period=rolling&bills=rent&bill=rent&groceryMonth=2026-07&grocery=top-ups",
  );
});

it("links every dashboard chart to its dedicated detail page", () => {
  const markup = renderToStaticMarkup(<BillsGroceriesDashboard {...dashboardProps} />);

  expect(markup).toContain('href="/bills-groceries/bills"');
  expect(markup).toContain('href="/bills-groceries/year-over-year"');
  expect(markup).toContain('href="/bills-groceries/groceries"');
  expect(markup).toContain('href="/bills-groceries/daily"');
});

it("renders only the requested chart and its table on a detail page", () => {
  const markup = renderToStaticMarkup(
    <TooltipProvider>
      <BillsGroceriesChartDetail chart="daily" {...dashboardProps} />
    </TooltipProvider>,
  );

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
  const markup = renderToStaticMarkup(
    <BillsGroceriesDashboard
      data={
        {
          ...liveData,
          bills: { ...liveData.bills, monthly: [], yearOverYear: [] },
        } as never
      }
      billIds={["rent"]}
      billId="rent"
      period="rolling"
    />,
  );

  expect(markup.match(/No Bills data yet\./g)).toHaveLength(2);
  expect(markup).not.toContain("No previous-year data");
});

it("renders equivalent live values, including zero-spend days, in detail tables", () => {
  const billsMarkup = renderToStaticMarkup(
    <TooltipProvider>
      <BillsGroceriesChartDetail chart="bills" data={liveData as never} billIds={["rent"]} billId="rent" period="rolling" />
    </TooltipProvider>,
  );
  const dailyMarkup = renderToStaticMarkup(
    <TooltipProvider>
      <BillsGroceriesChartDetail chart="daily" data={liveData as never} billIds={["rent"]} billId="rent" period="rolling" />
    </TooltipProvider>,
  );

  expect(billsMarkup).toContain("Rent");
  expect(billsMarkup).toContain("₪123.45");
  expect(dailyMarkup).toContain("2026-07-01");
  expect(dailyMarkup).toContain("₪0.00");
  expect(dailyMarkup).toContain("2026-07-02");
  expect(dailyMarkup).toContain("₪168.00");
});

it("includes the configured budget in the equivalent monthly Groceries table", () => {
  const markup = renderToStaticMarkup(
    <TooltipProvider>
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
      />
    </TooltipProvider>,
  );

  expect(markup).toContain("Monthly budget");
  expect(markup).toContain("₪2,000.00");
});
