import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bills-groceries",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("recharts", () => ({
  Bar: ({ children }: { children: ReactNode }) => <>{children}</>,
  BarChart: ({ children }: { children: ReactNode }) => <>{children}</>,
  CartesianGrid: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartLegend: ({ content }: { content: ReactNode }) => <>{content}</>,
  ChartLegendContent: ({ className }: { className?: string }) => <div className={className} />,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

import { BillsGroceriesDashboard } from "./bills-groceries-dashboard";

it("hides a nine-Bill legend below the mobile breakpoint", () => {
  const bills = Array.from({ length: 9 }, (_, index) => ({ id: `bill-${index}`, name: `Bill ${index + 1}`, color: "#123456" }));
  const markup = renderToStaticMarkup(
    <BillsGroceriesDashboard
      data={
        {
          months: ["2026-07"],
          bills: {
            category: { id: "bills", name: "Bills", color: "#111111" },
            subcategories: bills,
            monthly: bills.map((bill) => ({ month: "2026-07", subcategoryId: bill.id, agorot: 10_000 })),
            defaultSubcategoryId: "bill-0",
          },
          groceries: {
            category: null,
            subcategories: { mainRun: null, topUps: null },
            monthly: { budgetAgorot: null, months: [{ month: "2026-07", mainRunAgorot: 0, topUpsAgorot: 0 }] },
            daily: [],
            transactions: [],
          },
        } as never
      }
      billIds={bills.map((bill) => bill.id)}
      billId="bill-0"
      period="rolling"
    />,
  );

  expect(markup).toContain('class="hidden');
  expect(markup).toContain("md:grid");
});
