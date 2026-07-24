import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));
vi.mock("next/navigation", () => ({ usePathname: () => "/transactions", useRouter: () => ({ push: mocks.push }) }));

import TransactionsPage from "./page";

describe("Transactions page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDashboardData.mockResolvedValue({
      categories: [{ id: "food", name: "Food", kind: "expense", archivedAt: null }],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      report: {
        sharedBalance: 9000,
        income: 0,
        expenses: 0,
        expectedMonthlyIncome: null,
        categoryTotals: [],
        recentTransactions: [],
      },
    });
  });

  it("loads the selected ledger month and renders month and year selectors", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-06" }) }));

    expect(markup).toContain('aria-label="Select ledger month"');
    expect(markup).toContain('aria-label="Select ledger year"');
  });

  it("opens the import sidebar without replacing the transactions page", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ import: "1" }) }));

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Add transaction"');
  });
});
