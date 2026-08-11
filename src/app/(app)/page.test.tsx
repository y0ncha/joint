import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardBalance: vi.fn(),
  getDashboardControls: vi.fn(),
  getDashboardRecentActivity: vi.fn(),
  getDashboardSpending: vi.fn(),
  getDashboardSummary: vi.fn(),
  transactionSheetProps: null as null | {
    currentUserId: string;
    directCategories: Array<{ id: string }>;
    members: Array<{ id: string }>;
    subcategories: Array<{ id: string }>;
  },
}));

vi.mock("@/lib/dashboard-read-model", () => ({
  getDashboardBalance: mocks.getDashboardBalance,
  getDashboardControls: mocks.getDashboardControls,
  getDashboardRecentActivity: mocks.getDashboardRecentActivity,
  getDashboardSpending: mocks.getDashboardSpending,
  getDashboardSummary: mocks.getDashboardSummary,
}));
vi.mock("@/components/transaction-sheet", () => ({
  TransactionSheet: (props: NonNullable<typeof mocks.transactionSheetProps>) => {
    mocks.transactionSheetProps = props;
    return <button aria-label="Add transaction" />;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import Home, { BalanceCard, DashboardActions, IncomeCard, OutgoingsCard, RecentActivityCard, SpendingCard } from "./page";

const options = { month: "2026-07" };
const summary = {
  expenseChangePercentage: -7.6,
  expenses: 7940,
  income: 16400,
  incomeChangePercentage: 12.5,
};

function renderHome(searchParams: { from?: string; month?: string; spendingCategory?: string; to?: string } = {}) {
  return Home({ searchParams: Promise.resolve(searchParams) });
}

describe("Joint dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionSheetProps = null;
    mocks.getDashboardControls.mockResolvedValue({
      categories: [
        { id: "income-category-id", name: "Salary", kind: "income", archivedAt: null },
        { id: "home-category-id", name: "Home", kind: "expense", archivedAt: null },
      ],
      directCategories: [{ id: "other-expense-id", name: "Other", kind: "expense", archivedAt: null }],
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
    });
    mocks.getDashboardSummary.mockResolvedValue(summary);
    mocks.getDashboardSpending.mockResolvedValue({
      categoryTotals: [{ categoryId: "home-category-id", categoryName: "Home", amount: 4280 }],
    });
    mocks.getDashboardBalance.mockResolvedValue({ expectedMonthlyIncome: 18000, expenses: 7940, sharedBalance: 18420 });
    mocks.getDashboardRecentActivity.mockResolvedValue({
      transactions: [
        {
          id: "transaction-id",
          kind: "expense",
          amount: 186,
          categoryName: "Home",
          subcategoryName: "Groceries",
          note: "Super Pharm",
          merchant: "Super-Pharm Ltd.",
          source: "statement_import",
          occurredOn: "2026-07-14",
        },
      ],
    });
  });

  it("keeps the dashboard frame visible while controls and cards wait for focused reads", async () => {
    const markup = renderToStaticMarkup(await renderHome());

    expect(markup).toContain("Shared money");
    expect(markup).toContain('id="workspace-content"');
    expect(markup).not.toContain("<main");
    expect(markup).toContain("Loading dashboard controls");
    expect(markup).toContain("Loading Income");
    expect(markup).toContain("Loading Outgoings");
    expect(markup).toContain("Loading Where your money went");
    expect(markup).toContain("Loading Monthly balance");
    expect(markup).toContain("Loading Latest activity");
    expect(mocks.getDashboardSummary).toHaveBeenCalledOnce();
  });

  it("defaults its monthly reads to the previous month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));

    renderToStaticMarkup(await renderHome());

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith({ month: "2026-07" });
    vi.useRealTimers();
  });

  it("renders each restored card from its focused read", async () => {
    const summaryPromise = Promise.resolve(summary);
    const markup = [
      renderToStaticMarkup(await IncomeCard({ range: undefined, summary: summaryPromise })),
      renderToStaticMarkup(await OutgoingsCard({ range: undefined, summary: summaryPromise })),
      renderToStaticMarkup(await SpendingCard({ monthLabel: "July 2026", options })),
      renderToStaticMarkup(await BalanceCard({ options, range: undefined })),
      renderToStaticMarkup(await RecentActivityCard({ options })),
    ].join("");

    expect(markup).toContain("Income");
    expect(markup).toContain("Outgoings");
    expect(markup).toContain("13% above prior 3-month average");
    expect(markup).toContain("8% below prior 3-month average");
    expect(markup).toContain("Monthly balance");
    expect(markup).toContain("Based on 3-month income average");
    expect(markup).toContain("18,420");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("July 2026");
    expect(markup).toContain('aria-label="Break down spending by category"');
    expect(markup).toContain("Super-Pharm Ltd.");
    expect(markup).toContain("Home → Groceries - 2026-07-14");
    expect(markup).toContain("Imported");
    expect(mocks.getDashboardSpending).toHaveBeenCalledWith(options);
    expect(mocks.getDashboardBalance).toHaveBeenCalledWith(options);
    expect(mocks.getDashboardRecentActivity).toHaveBeenCalledWith(options);
  });

  it("passes the resolved control data to the transaction entry sheet", async () => {
    const markup = renderToStaticMarkup(await DashboardActions({ month: "2026-07", range: undefined }));

    expect(markup).toContain('aria-label="Add transaction"');
    expect(markup).toContain('aria-label="Dashboard controls"');
    expect(mocks.transactionSheetProps).toMatchObject({
      currentUserId: "member-id",
      directCategories: [{ id: "other-expense-id" }],
      members: [{ id: "member-id" }],
      subcategories: [{ id: "groceries" }],
    });
  });

  it("falls back to Uncategorized when recent activity has no category label", async () => {
    mocks.getDashboardRecentActivity.mockResolvedValueOnce({
      transactions: [
        {
          id: "uncategorized",
          kind: "expense",
          amount: 1,
          categoryName: null,
          subcategoryName: null,
          note: "No category",
          merchant: null,
          source: "manual",
          occurredOn: "2026-07-14",
        },
      ],
    });

    const markup = renderToStaticMarkup(await RecentActivityCard({ options }));

    expect(markup).toContain("Uncategorized - 2026-07-14");
  });

  it("renders a directly selected inactive month and queries its report", async () => {
    renderToStaticMarkup(await renderHome({ month: "2026-06" }));

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith({ month: "2026-06" });
  });

  it("uses an eligible URL category to request its subcategory spending", async () => {
    renderToStaticMarkup(await renderHome({ spendingCategory: "00000000-0000-0000-0000-000000000521" }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledWith({
      month: "2026-07",
      spendingCategoryId: "00000000-0000-0000-0000-000000000521",
    });
  });

  it("ignores an invalid spending category URL value", async () => {
    renderToStaticMarkup(await renderHome({ spendingCategory: "not-a-uuid" }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledWith({ month: "2026-07" });
  });

  it("passes a selected custom range to focused dashboard reads", async () => {
    const range = { from: "2026-07-01", to: "2026-07-15" };
    const rangeOptions = { month: expect.any(String), range };

    renderToStaticMarkup(await renderHome(range));
    const markup = renderToStaticMarkup(await SpendingCard({ monthLabel: "July 2026", options: { month: "2026-07", range } }));

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith(rangeOptions);
    expect(mocks.getDashboardSpending).toHaveBeenCalledWith({ month: "2026-07", range });
    expect(markup).toContain("01/07/2026 – 15/07/2026");
  });

  it("ignores an impossible custom range", async () => {
    renderToStaticMarkup(await renderHome({ from: "2026-02-30", to: "2026-03-01" }));

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith({ month: expect.any(String) });
  });

  it("shows no available income when there is no recent income average", async () => {
    const noIncomeSummary = Promise.resolve({ ...summary, income: 0, incomeChangePercentage: null });
    mocks.getDashboardBalance.mockResolvedValueOnce({ expectedMonthlyIncome: null, expenses: 1200, sharedBalance: 7000 });

    const markup = [
      renderToStaticMarkup(await IncomeCard({ range: undefined, summary: noIncomeSummary })),
      renderToStaticMarkup(await BalanceCard({ options, range: undefined })),
    ].join("");

    expect(markup).toContain("No available income");
    expect(markup).toContain("No 3-month income history yet. Record income in the prior 3 months to compare this month.");
    expect(markup).not.toContain("Based on 3-month income average");
  });

  it("shows the below-average income comparison", async () => {
    const markup = renderToStaticMarkup(
      await IncomeCard({ range: undefined, summary: Promise.resolve({ ...summary, incomeChangePercentage: -10 }) }),
    );

    expect(markup).toContain("10% below prior 3-month average");
  });
});
