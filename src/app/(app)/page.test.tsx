import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import Home from "./page";

function renderHome() {
  return Home({ searchParams: Promise.resolve({}) });
}

describe("Joint dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDashboardData.mockResolvedValue({
      categories: [
        { id: "income-category-id", name: "Salary", kind: "income", archivedAt: null },
        { id: "home-category-id", name: "Home", kind: "expense", archivedAt: null },
      ],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      report: {
        sharedBalance: 18420,
        income: 16400,
        expenses: 7940,
        incomeChangePercentage: 12.5,
        expenseChangePercentage: -7.6,
        expectedMonthlyIncome: 18000,
        categoryTotals: [{ categoryId: "home-category-id", categoryName: "Home", amount: 4280 }],
        recentTransactions: [
          {
            id: "transaction-id",
            kind: "expense",
            amount: 186,
            categoryId: null,
            note: "Super Pharm",
            merchant: "Super-Pharm Ltd.",
            source: "statement_import",
            occurredOn: "2026-07-14",
            paidBy: null,
          },
        ],
      },
    });
  });

  it("shows the restored dashboard cards with live household values", async () => {
    const markup = renderToStaticMarkup(await renderHome());

    expect(markup).toContain("aria-label=\"Add transaction\"");
    expect(markup).toContain("lucide-plus");
    expect(markup).not.toContain("sm:hidden");
    expect(markup).not.toContain("hidden sm:block");
    expect(markup).not.toContain("Choose your accent color");
    expect(markup).not.toContain("lucide-bell");
    expect(markup).not.toContain("Shared balance");
    expect(markup).not.toContain("Available in the shared bank account");
    expect(markup).toContain("Income");
    expect(markup).toContain("Outgoings");
    expect(markup).toContain("13% above prior 3-month average");
    expect(markup).toContain("8% below prior 3-month average");
    expect(markup).toMatch(/Income[\s\S]*lucide-arrow-up-right[\s\S]*13% above prior 3-month average/);
    expect(markup).not.toContain("of income");
    expect(markup).toContain("Monthly balance");
    expect(markup).not.toContain("Expected income after outgoings");
    expect(markup).toContain("Based on 3-month income average");
    expect(markup).toContain("18,420");
    expect(markup).not.toContain("10,060");
    expect(markup).not.toContain("Income vs outgoings");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("More chart options");
    expect(markup).toContain("Super-Pharm Ltd.");
    expect(markup).toContain("Uncategorized - 2026-07-14");
    expect(markup).toContain("Imported");
    expect(markup).not.toContain("Upcoming card charge");
    expect(markup).not.toContain("Card debt");
    expect(markup).not.toContain("credit card");
    expect(markup).toContain('alt="Joint logo"');
    expect(markup).not.toContain("flaticon.com");
    expect(markup).not.toContain('data-slot="tooltip-trigger"');
  });

  it("shows no available income when there is no recent income average", async () => {
    mocks.getDashboardData.mockResolvedValueOnce({
      categories: [],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      report: {
        sharedBalance: 7000,
        income: 0,
        expenses: 1200,
        incomeChangePercentage: null,
        expenseChangePercentage: null,
        expectedMonthlyIncome: null,
        categoryTotals: [],
        recentTransactions: [],
      },
    });

    const markup = renderToStaticMarkup(await renderHome());

    expect(markup).toContain("No available income");
    expect(markup).toContain("No 3-month income history yet. Record income in the prior 3 months to compare this month.");
    expect(markup).not.toContain("Based on 3-month income average");
  });

  it("uses a downward arrow when income is below its prior average", async () => {
    mocks.getDashboardData.mockResolvedValueOnce({
      categories: [],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      report: {
        sharedBalance: 7000,
        income: 1000,
        expenses: 1200,
        incomeChangePercentage: -10,
        expenseChangePercentage: null,
        expectedMonthlyIncome: 1000,
        categoryTotals: [],
        recentTransactions: [],
      },
    });

    const markup = renderToStaticMarkup(await renderHome());

    expect(markup).toMatch(/Income[\s\S]*lucide-arrow-down-right[\s\S]*10% below prior 3-month average/);
  });
});
