import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import BillsGroceriesDetailPage from "./[chart]/page";

const mocks = vi.hoisted(() => ({
  loadBillsGroceriesPage: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));

vi.mock("@/components/bills-groceries-dashboard", () => ({
  billsGroceriesChartIds: ["bills", "year-over-year", "groceries", "daily"],
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

beforeEach(() => {
  mocks.loadBillsGroceriesPage.mockReset();
  mocks.notFound.mockClear();
  mocks.redirect.mockClear();
});

it.each(["bills", "year-over-year", "groceries", "daily"] as const)("renders %s as a header-free live chart detail page", async (chart) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  mocks.loadBillsGroceriesPage.mockResolvedValue({
    canonical: new URLSearchParams(`period=rolling&bills=rent&bill=rent&groceryMonth=${currentMonth}`),
    data: { marker: "live" },
    params: new URLSearchParams(`period=rolling&bills=rent&bill=rent&groceryMonth=${currentMonth}`),
    selected: {
      billIds: ["rent"],
      billId: "rent",
      period: "rolling",
    },
  });
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
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it.each(["yoy", "unknown"])("calls notFound for the invalid %s chart segment", async (chart) => {
  await expect(
    BillsGroceriesDetailPage({
      params: Promise.resolve({ chart }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NOT_FOUND");

  expect(mocks.notFound).toHaveBeenCalledOnce();
  expect(mocks.loadBillsGroceriesPage).not.toHaveBeenCalled();
});

it("redirects a valid detail chart to its canonical query before rendering", async () => {
  mocks.loadBillsGroceriesPage.mockResolvedValue({
    canonical: new URLSearchParams("period=rolling&bills=rent&groceryMonth=2026-07&source=household"),
    data: { marker: "live" },
    params: new URLSearchParams("period=calendar&bills=rent&groceryMonth=2026-07&source=household"),
    selected: { billIds: ["rent"], billId: "rent", period: "rolling" },
  });

  await expect(
    BillsGroceriesDetailPage({
      params: Promise.resolve({ chart: "bills" }),
      searchParams: Promise.resolve({ period: "calendar", bills: "rent", groceryMonth: "2026-07", source: "household" }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT:/bills-groceries/bills?period=rolling&bills=rent&groceryMonth=2026-07&source=household");

  expect(mocks.redirect).toHaveBeenCalledWith("/bills-groceries/bills?period=rolling&bills=rent&groceryMonth=2026-07&source=household");
});

it("redirects an invalid month on the year-over-year detail route before rendering", async () => {
  mocks.loadBillsGroceriesPage.mockResolvedValue({
    canonical: new URLSearchParams("period=rolling&bills=rent&bill=rent&groceryMonth=2026-07"),
    data: { marker: "live" },
    params: new URLSearchParams("period=rolling&bills=rent&bill=rent&groceryMonth=2026-13"),
    selected: { billIds: ["rent"], billId: "rent", period: "rolling" },
  });

  await expect(
    BillsGroceriesDetailPage({
      params: Promise.resolve({ chart: "year-over-year" }),
      searchParams: Promise.resolve({ period: "rolling", bills: "rent", bill: "rent", groceryMonth: "2026-13" }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT:/bills-groceries/year-over-year?period=rolling&bills=rent&bill=rent&groceryMonth=2026-07");

  expect(mocks.redirect).toHaveBeenCalledWith("/bills-groceries/year-over-year?period=rolling&bills=rent&bill=rent&groceryMonth=2026-07");
});
