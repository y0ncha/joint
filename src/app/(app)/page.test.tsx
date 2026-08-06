import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
  transactionSubcategories: [] as Array<{ id: string }>,
}));

vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));
vi.mock("@/components/transaction-sheet", () => ({
  TransactionSheet: ({ subcategories }: { subcategories: Array<{ id: string }> }) => {
    mocks.transactionSubcategories = subcategories;
    return <button aria-label="Add transaction" />;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

import Home from "./page";

function renderHome(searchParams: { from?: string; month?: string; to?: string } = {}) {
  return Home({ searchParams: Promise.resolve(searchParams) });
}

describe("Joint dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDashboardData.mockResolvedValue({
      categories: [
        { id: "income-category-id", name: "Salary", kind: "income", archivedAt: null },
        { id: "home-category-id", name: "Home", kind: "expense", archivedAt: null },
      ],
      directCategories: [],
      subcategories: [
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "home-category-id",
          categoryName: "Home",
          kind: "expense",
          color: "#d9f0fa",
          icon: "home",
          archivedAt: null,
          categoryArchivedAt: null,
        },
        {
          id: "archived-home",
          name: "Archived home",
          categoryId: "home-category-id",
          categoryName: "Home",
          kind: "expense",
          color: "#d9f0fa",
          icon: "home",
          archivedAt: "2026-07-01T00:00:00Z",
          categoryArchivedAt: null,
        },
      ],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      transactions: [{ occurredOn: "2026-07-14" }],
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
            subcategoryId: "groceries",
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

    expect(markup).toContain('aria-label="Add transaction"');
    expect(markup).toContain("Income");
    expect(markup).toContain('aria-label="Dashboard controls"');
    expect(markup).toContain("Outgoings");
    expect(markup).toContain("13% above prior 3-month average");
    expect(markup).toContain("8% below prior 3-month average");
    expect(markup).toContain("Monthly balance");
    expect(markup).toContain("Based on 3-month income average");
    expect(markup).toContain("18,420");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("More chart options");
    expect(markup).toContain("Super-Pharm Ltd.");
    expect(markup).toContain("Home → Groceries - 2026-07-14");
    expect(markup).toContain("Imported");
    expect(markup).toContain('alt="Joint logo"');
  });

  it("passes only active matching-kind children to the transaction entry sheet", async () => {
    renderToStaticMarkup(await renderHome());

    expect(mocks.transactionSubcategories).toEqual([expect.objectContaining({ id: "groceries" })]);
  });

  it("falls back to Uncategorized when recent activity has no resolvable subcategory", async () => {
    mocks.getDashboardData.mockResolvedValueOnce({
      categories: [],
      directCategories: [],
      subcategories: [],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      transactions: [],
      report: {
        sharedBalance: 0,
        income: 0,
        expenses: 0,
        incomeChangePercentage: null,
        expenseChangePercentage: null,
        expectedMonthlyIncome: null,
        categoryTotals: [],
        recentTransactions: [
          {
            id: "uncategorized",
            kind: "expense",
            amount: 1,
            subcategoryId: null,
            note: "No category",
            occurredOn: "2026-07-14",
            createdAt: "2026-07-14T00:00:00Z",
            paidBy: null,
          },
          {
            id: "missing",
            kind: "expense",
            amount: 1,
            subcategoryId: "missing-subcategory",
            note: "Missing category",
            occurredOn: "2026-07-15",
            createdAt: "2026-07-15T00:00:00Z",
            paidBy: null,
          },
        ],
      },
    });

    const markup = renderToStaticMarkup(await renderHome());

    expect(markup).toContain("Uncategorized - 2026-07-14");
    expect(markup).toContain("Uncategorized - 2026-07-15");
  });

  it("renders a directly selected inactive month and queries its report", async () => {
    renderToStaticMarkup(await renderHome({ month: "2026-06" }));

    expect(mocks.getDashboardData).toHaveBeenCalledWith("2026-06");
  });

  it("passes a selected custom range to the dashboard report", async () => {
    const markup = renderToStaticMarkup(await renderHome({ from: "2026-07-01", to: "2026-07-15" }));

    expect(mocks.getDashboardData).toHaveBeenCalledWith(expect.any(String), { from: "2026-07-01", to: "2026-07-15" });
    expect(markup).toContain("01/07/2026 – 15/07/2026");
  });

  it("ignores an impossible custom range", async () => {
    renderToStaticMarkup(await renderHome({ from: "2026-02-30", to: "2026-03-01" }));

    expect(mocks.getDashboardData).toHaveBeenCalledWith(expect.any(String));
  });

  it("shows no available income when there is no recent income average", async () => {
    mocks.getDashboardData.mockResolvedValueOnce({
      categories: [],
      directCategories: [],
      subcategories: [],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      transactions: [],
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

  it("shows the below-average income comparison", async () => {
    mocks.getDashboardData.mockResolvedValueOnce({
      categories: [],
      directCategories: [],
      subcategories: [],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      transactions: [],
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

    expect(markup).toContain("10% below prior 3-month average");
  });
});
