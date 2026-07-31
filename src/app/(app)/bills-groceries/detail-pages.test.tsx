import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import BillsPage from "./bills/page";
import DailyPage from "./daily/page";
import GroceriesPage from "./groceries/page";
import YearOverYearPage from "./year-over-year/page";

const mocks = vi.hoisted(() => ({
  getBillsGroceriesData: vi.fn(),
}));

vi.mock("@/components/bills-groceries-dashboard", () => ({
  BillsGroceriesChartDetail: ({
    chart,
    data,
    billIds,
    billId,
    period,
  }: {
    chart: string;
    data?: { marker: string };
    billIds?: string[];
    billId?: string | null;
    period?: string;
  }) => <output>{[chart, data?.marker, billIds?.join(","), billId, period].join("|")}</output>,
}));

vi.mock("@/lib/bills-groceries-data", () => ({ getBillsGroceriesData: mocks.getBillsGroceriesData }));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ title, opaqueContent, children }: { title?: string; opaqueContent?: boolean; children: React.ReactNode }) => (
    <main>
      {title ? <h1>{title}</h1> : null}
      <output>{String(opaqueContent)}</output>
      {children}
    </main>
  ),
}));

it.each([
  [BillsPage, "bills"],
  [YearOverYearPage, "yoy"],
  [GroceriesPage, "groceries"],
  [DailyPage, "daily"],
])("renders %s as a header-free live chart detail page", async (Page, chart) => {
  mocks.getBillsGroceriesData.mockResolvedValue({
    marker: "live",
    bills: {
      subcategories: [{ id: "rent", name: "Rent" }],
      defaultSubcategoryId: "rent",
    },
  });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const markup = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({
        period: "rolling",
        bills: "rent",
        bill: "rent",
        groceryMonth: currentMonth,
      }),
    }),
  );

  expect(markup).not.toContain("<h1>");
  expect(markup).toContain("<output>true</output>");
  expect(markup).toContain(`<output>${chart}|live|rent|rent|rolling</output>`);
  expect(mocks.getBillsGroceriesData).toHaveBeenLastCalledWith({
    currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    groceryRange: {
      from: `${currentMonth}-01`,
      to: expect.stringMatching(new RegExp(`^${currentMonth}-\\d{2}$`)),
    },
    period: "rolling",
  });
});
