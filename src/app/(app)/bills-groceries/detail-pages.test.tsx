import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import BillsGroceriesDetailPage from "./[chart]/page";

const mocks = vi.hoisted(() => ({
  loadBillsGroceriesPage: vi.fn(),
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

vi.mock("@/lib/bills-groceries-page", () => ({ loadBillsGroceriesPage: mocks.loadBillsGroceriesPage }));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ title, opaqueContent, children }: { title?: string; opaqueContent?: boolean; children: React.ReactNode }) => (
    <main>
      {title ? <h1>{title}</h1> : null}
      <output>{String(opaqueContent)}</output>
      {children}
    </main>
  ),
}));

it.each(["bills", "yoy", "groceries", "daily"] as const)("renders %s as a header-free live chart detail page", async (chart) => {
  mocks.loadBillsGroceriesPage.mockResolvedValue({
    data: { marker: "live" },
    selected: {
      billIds: ["rent"],
      billId: "rent",
      period: "rolling",
    },
  });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const markup = renderToStaticMarkup(
    await BillsGroceriesDetailPage({
      params: Promise.resolve({ chart }),
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
  expect(mocks.loadBillsGroceriesPage).toHaveBeenLastCalledWith({
    bill: "rent",
    bills: "rent",
    groceryMonth: currentMonth,
    period: "rolling",
  });
});
