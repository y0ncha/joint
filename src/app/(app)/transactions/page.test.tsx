import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));
vi.mock("next/navigation", () => ({ usePathname: () => "/transactions", useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }));

import TransactionsPage from "./page";

describe("Transactions page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDashboardData.mockResolvedValue({
      categories: [{ id: "food", name: "Food", kind: "expense", archivedAt: null }],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      transactions: [
        { id: "outside", kind: "expense", amount: 10, occurredOn: "2026-06-01", categoryId: null, note: "Outside range", createdAt: "2026-06-01T08:00:00Z", paidBy: null },
        { id: "inside", kind: "expense", amount: 10, occurredOn: "2026-06-15", categoryId: null, note: "Inside range", createdAt: "2026-06-15T08:00:00Z", paidBy: null },
      ],
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

    expect(mocks.getDashboardData).toHaveBeenCalledWith("2026-06");
    expect(markup).toContain('aria-label="Select ledger month"');
    expect(markup).toContain('aria-label="Select ledger year"');
  });

  it("opens the import sidebar without replacing the transactions page", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ import: "1" }) }));

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Add transaction"');
  });

  it("uses all household transactions for a custom date range", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ from: "2026-06-10", to: "2026-06-20" }) }));

    expect(markup).toContain("Inside range");
    expect(markup).not.toContain("Outside range");
  });
});
