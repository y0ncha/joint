import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardControls: vi.fn(),
  getDashboardMonthlyReview: vi.fn(),
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
  getDashboardControls: mocks.getDashboardControls,
  getDashboardMonthlyReview: mocks.getDashboardMonthlyReview,
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

import Home, { BudgetsPlaceholder, DashboardActions, DashboardMetricCards, DashboardTrendCard, SpendingCard } from "./page";

const options = { month: "2026-07" };
const summary = {
  expenseChangePercentage: -7.6,
  expenses: 7940,
  income: 16400,
  incomeChangePercentage: 12.5,
};
const monthlyReview = [
  { month: "2026-02-01", income: 8000, expenses: 5000, savings: 3000 },
  { month: "2026-03-01", income: 9000, expenses: 6000, savings: 3000 },
  { month: "2026-04-01", income: 9000, expenses: 6000, savings: 3000 },
  { month: "2026-05-01", income: 11000, expenses: 7000, savings: 4000 },
  { month: "2026-06-01", income: 10000, expenses: 8000, savings: 2000 },
  { month: "2026-07-01", income: 12000, expenses: 9000, savings: 3000 },
];

function renderHome(
  searchParams: { from?: string; month?: string; spendingCategories?: string; spendingGranularity?: string; to?: string } = {},
) {
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
        { id: "bills-category-id", name: "Bills", kind: "expense", archivedAt: null },
        { id: "00000000-0000-0000-0000-000000000521", name: "Utilities", kind: "expense", archivedAt: null },
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
        {
          id: "bills-subcategory",
          name: "Arnona",
          categoryId: "bills-category-id",
          categoryName: "Bills",
          kind: "expense",
          color: "#d9f0fa",
          icon: "home",
          archivedAt: null,
          categoryArchivedAt: null,
        },
        {
          id: "utilities-subcategory",
          name: "Electricity",
          categoryId: "00000000-0000-0000-0000-000000000521",
          categoryName: "Utilities",
          kind: "expense",
          color: "#d9f0fa",
          icon: "home",
          archivedAt: null,
          categoryArchivedAt: null,
        },
      ],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
    });
    mocks.getDashboardSummary.mockResolvedValue(summary);
    mocks.getDashboardMonthlyReview.mockResolvedValue(monthlyReview);
    mocks.getDashboardSpending.mockResolvedValue({
      categoryTotals: [{ categoryId: "home-category-id", categoryName: "Home", amount: 4280 }],
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
    expect(markup).toContain("Loading Monthly balance");
    expect(markup).toContain("Loading Where your money went");
    expect(markup).toContain("Budgets are coming soon.");
    expect(markup).toContain("Loading Six-month trend");
    expect(markup).not.toContain("Latest activity");
  });

  it("defaults its monthly reads to the previous month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));

    renderToStaticMarkup(await renderHome());

    expect(mocks.getDashboardMonthlyReview).toHaveBeenCalledWith("2026-07");
    vi.useRealTimers();
  });

  it("renders the approved card grid from focused reads", async () => {
    const review = Promise.resolve(monthlyReview);
    const markup = [
      renderToStaticMarkup(await DashboardMetricCards({ options, review })),
      renderToStaticMarkup(await SpendingCard({ options })),
      renderToStaticMarkup(<BudgetsPlaceholder />),
      renderToStaticMarkup(await DashboardTrendCard({ review })),
    ].join("");

    expect(markup).toContain("Income");
    expect(markup).toContain("Outgoings");
    expect(markup).toContain("Monthly balance");
    expect(markup).toContain("20% above previous 3-month average");
    expect(markup).toContain("29% above previous 3-month average");
    expect(markup).toContain("In line with previous 3-month average");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("Expense categories for this period.");
    expect(markup).toContain("Budgets");
    expect(markup).toContain("Budgets are coming soon.");
    expect(markup).not.toContain("Largest changes");
    expect(markup).toContain("Six-month trend");
    expect(markup).toContain('data-slot="card-header"');
    expect(markup).toContain('data-slot="card-action"');
    expect(markup).toContain("flex min-h-0 flex-1 items-center justify-center [container-type:size]");
    expect(markup).toContain("lg:col-span-5 lg:aspect-square");
    expect(markup).toContain("lg:col-span-7");
    expect([...markup.matchAll(/lg:col-span-4/g)]).toHaveLength(3);
    expect(markup).toContain("lg:col-span-12");
    expect(markup).toContain('aria-label="Configure spending breakdown"');
    expect(markup).not.toContain("Latest activity");
    expect(mocks.getDashboardSpending).toHaveBeenCalledWith(options);
  });

  it("keeps fewer than three selected categories aggregated", async () => {
    mocks.getDashboardSpending.mockImplementation(async (spendingOptions) => {
      if (spendingOptions.spendingCategoryId === "home-category-id") {
        return { categoryTotals: [{ categoryId: "rent", categoryName: "Rent", amount: 3000 }] };
      }
      if (spendingOptions.spendingCategoryId === "bills-category-id") {
        return { categoryTotals: [{ categoryId: "arnona", categoryName: "Arnona", amount: 1122 }] };
      }
      return {
        categoryTotals: [
          { categoryId: "home-category-id", categoryName: "Home", amount: 3000 },
          { categoryId: "bills-category-id", categoryName: "Bills", amount: 1122 },
        ],
      };
    });

    const markup = renderToStaticMarkup(
      await SpendingCard({ options: { month: "2026-07", spendingCategoryIds: ["home-category-id", "bills-category-id"] } as never }),
    );

    expect(markup).toContain("₪4,122");
    expect(markup).toContain('aria-label="Spending breakdown: Home ₪3,000, Bills ₪1,122"');
    expect(mocks.getDashboardSpending).toHaveBeenCalledTimes(1);
    expect(markup).not.toContain("<title>");
    expect(markup).not.toContain('aria-live="polite"');
    expect(markup).not.toContain("cursor-pointer");
    expect(markup).not.toContain('role="list"');
    expect(markup).not.toContain(">Total spending<");
  });

  it("defaults subcategory mode to all categories", async () => {
    mocks.getDashboardSpending.mockImplementation(async ({ spendingCategoryId }: { spendingCategoryId?: string }) => {
      if (spendingCategoryId === "home-category-id")
        return { categoryTotals: [{ categoryId: "groceries", categoryName: "Groceries", amount: 100 }] };
      if (spendingCategoryId === "bills-category-id")
        return { categoryTotals: [{ categoryId: "arnona", categoryName: "Arnona", amount: 200 }] };
      if (spendingCategoryId === "00000000-0000-0000-0000-000000000521") {
        return { categoryTotals: [{ categoryId: "electricity", categoryName: "Electricity", amount: 300 }] };
      }
      return { categoryTotals: [] };
    });

    const markup = renderToStaticMarkup(await SpendingCard({ options: { ...options, spendingGranularity: "subcategories" } }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledTimes(4);
    expect(markup).toContain('aria-label="Spending breakdown: Groceries ₪100, Arnona ₪200, Electricity ₪300"');
  });

  it("passes the resolved control data to the transaction entry sheet", async () => {
    const markup = renderToStaticMarkup(await DashboardActions({ month: "2026-07", range: undefined }));

    expect(markup).toContain('aria-label="Add transaction"');
    expect(markup).toContain('aria-label="Dashboard controls"');
    expect(mocks.transactionSheetProps).toMatchObject({
      currentUserId: "member-id",
      directCategories: [{ id: "other-expense-id" }],
      members: [{ id: "member-id" }],
    });
    expect(mocks.transactionSheetProps?.subcategories).toContainEqual(expect.objectContaining({ id: "groceries" }));
  });

  it("renders a directly selected inactive month and queries its report", async () => {
    renderToStaticMarkup(await renderHome({ month: "2026-06" }));

    expect(mocks.getDashboardMonthlyReview).toHaveBeenCalledWith("2026-06");
  });

  it("uses an eligible URL category to request its subcategory spending", async () => {
    renderToStaticMarkup(await renderHome({ spendingCategories: "00000000-0000-0000-0000-000000000521" }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledWith({
      month: "2026-07",
      spendingCategoryIds: ["00000000-0000-0000-0000-000000000521"],
    });
  });

  it("ignores an invalid spending category URL value", async () => {
    renderToStaticMarkup(await renderHome({ spendingCategories: "not-a-uuid" }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledWith({ month: "2026-07" });
  });

  it("passes a selected custom range to focused dashboard reads", async () => {
    const range = { from: "2026-07-01", to: "2026-07-15" };
    const rangeOptions = { month: "2026-07", range };
    const summaries = new Map([
      ["2026-07-15", { expenses: 7940, income: 16_400 }],
      ["2026-06-30", { expenses: 4000, income: 10_000 }],
      ["2026-06-15", { expenses: 2500, income: 9000 }],
      ["2026-05-31", { expenses: 3800, income: 10_500 }],
    ]);
    mocks.getDashboardSummary.mockImplementation(async ({ range: requestedRange }: typeof rangeOptions) => ({
      ...summaries.get(requestedRange?.to ?? "2026-07-15"),
      expenseChangePercentage: -7.6,
      incomeChangePercentage: 12.5,
    }));

    const markup = renderToStaticMarkup(await DashboardMetricCards({ options: rangeOptions, review: Promise.resolve(monthlyReview) }));

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith(rangeOptions);
    expect(mocks.getDashboardSummary.mock.calls.map(([value]) => value.range)).toEqual([
      range,
      { from: "2026-06-16", to: "2026-06-30" },
      { from: "2026-06-01", to: "2026-06-15" },
      { from: "2026-05-17", to: "2026-05-31" },
    ]);
    expect(markup).toContain("13% above previous 3 equivalent ranges");
    expect(markup).toContain("8% below previous 3 equivalent ranges");
    expect(markup).toContain("32% above previous 3 equivalent ranges");
  });

  it("ignores an impossible custom range", async () => {
    renderToStaticMarkup(await renderHome({ from: "2026-02-30", to: "2026-03-01" }));

    expect(mocks.getDashboardMonthlyReview).toHaveBeenCalledWith(expect.any(String));
  });
});
