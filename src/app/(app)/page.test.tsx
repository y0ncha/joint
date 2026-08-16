import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardControls: vi.fn(),
  getDashboardMonthlyReview: vi.fn(),
  getDashboardSpending: vi.fn(),
  getDashboardSummary: vi.fn(),
  getBudgetsGoalsData: vi.fn(),
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
vi.mock("@/lib/budgets-goals-data", () => ({ getBudgetsGoalsData: mocks.getBudgetsGoalsData }));
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

import Home, { BudgetsGoalsWidget, DashboardActions, DashboardMetricCards, DashboardTrendCard, SpendingCard } from "./page";

const options = { month: "2026-07" };
const summary = {
  balanceChangePercentage: 5.4,
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
const budgetsGoalsData = {
  budgets: [
    {
      id: "rent",
      label: "Rent",
      name: "Rent",
      monthlyBudget: 1000,
      spent: 1500,
      targetKind: "category" as const,
      progress: {
        spentAgorot: 150000,
        budgetAgorot: 100000,
        percentage: 150,
        barPercentage: 100,
        remainingAgorot: 0,
        overBudgetAgorot: 50000,
      },
    },
    {
      id: "groceries",
      label: "Groceries",
      name: "Groceries",
      monthlyBudget: 500,
      spent: 400,
      targetKind: "subcategory" as const,
      progress: {
        spentAgorot: 40000,
        budgetAgorot: 50000,
        percentage: 80,
        barPercentage: 80,
        remainingAgorot: 10000,
        overBudgetAgorot: 0,
      },
    },
    {
      id: "other",
      label: "Other",
      name: "Other",
      monthlyBudget: 200,
      spent: 20,
      targetKind: "category" as const,
      progress: {
        spentAgorot: 2000,
        budgetAgorot: 20000,
        percentage: 10,
        barPercentage: 10,
        remainingAgorot: 18000,
        overBudgetAgorot: 0,
      },
    },
  ],
  goals: [
    {
      id: "soon",
      label: "Emergency fund",
      name: "Emergency fund",
      savedAmount: 250,
      targetAmount: 1000,
      targetDate: "2026-09-01",
      progress: {
        targetAgorot: 100000,
        savedAgorot: 25000,
        percentage: 25,
        barPercentage: 25,
        remainingAgorot: 75000,
        monthlyRequiredAgorot: 37500,
        remainingMonths: 2,
        status: "active" as const,
      },
    },
    {
      id: "later",
      label: "Holiday",
      name: "Holiday",
      savedAmount: 0,
      targetAmount: 500,
      targetDate: "2027-01-01",
      progress: {
        targetAgorot: 50000,
        savedAgorot: 0,
        percentage: 0,
        barPercentage: 0,
        remainingAgorot: 50000,
        monthlyRequiredAgorot: 10000,
        remainingMonths: 5,
        status: "active" as const,
      },
    },
    {
      id: "done",
      label: "Finished",
      name: "Finished",
      savedAmount: 100,
      targetAmount: 100,
      targetDate: "2026-01-01",
      progress: {
        targetAgorot: 10000,
        savedAgorot: 10000,
        percentage: 100,
        barPercentage: 100,
        remainingAgorot: 0,
        monthlyRequiredAgorot: 0,
        remainingMonths: null,
        status: "complete" as const,
      },
    },
  ],
  targets: { categories: [], subcategories: [] },
};

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
    mocks.getBudgetsGoalsData.mockResolvedValue(budgetsGoalsData);
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
    expect(markup).toContain("Loading Budgets &amp; Goals");
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

  it("rejects an invalid requested month before dashboard reads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));

    renderToStaticMarkup(await renderHome({ month: "2026-99" }));

    expect(mocks.getDashboardMonthlyReview).toHaveBeenCalledWith("2026-07");
    vi.useRealTimers();
  });

  it("renders the approved card grid from focused reads", async () => {
    const review = Promise.resolve(monthlyReview);
    const markup = [
      renderToStaticMarkup(await DashboardMetricCards({ options })),
      renderToStaticMarkup(await SpendingCard({ options })),
      renderToStaticMarkup(await BudgetsGoalsWidget({ options })),
      renderToStaticMarkup(await DashboardTrendCard({ review })),
    ].join("");

    expect(markup).toContain("Income");
    expect(markup).toContain("Outgoings");
    expect(markup).toContain("Monthly balance");
    expect(markup).toContain("13% above previous 3-month average");
    expect(markup).toContain("8% below previous 3-month average");
    expect(markup).toContain("5% above previous 3-month average");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("Expense categories for this period.");
    expect(markup).toContain("Budgets &amp; Goals");
    expect(markup).toContain('href="/budgets-goals"');
    expect(markup).toContain('aria-label="Edit budgets and goals"');
    expect(markup).not.toContain(">Manage<");
    expect(markup).not.toContain("Largest changes");
    expect(markup).toContain("Six-month trend");
    expect(markup).toContain('data-slot="card-header"');
    expect(markup).toContain('data-slot="card-action"');
    expect(markup).toContain("flex min-h-0 flex-1 items-center justify-center");
    expect(markup).toContain("lg:col-span-5 md:aspect-square");
    expect(markup).toContain("lg:col-span-7");
    expect([...markup.matchAll(/lg:col-span-4/g)]).toHaveLength(3);
    expect(markup).toContain("lg:col-span-12");
    expect(markup).toContain('aria-label="Configure spending breakdown"');
    expect(markup).not.toContain("Latest activity");
    expect(mocks.getDashboardSummary).toHaveBeenCalledWith(options);
    expect(mocks.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(mocks.getDashboardSpending).toHaveBeenCalledWith(options);
    expect(mocks.getBudgetsGoalsData).toHaveBeenCalledWith(options);
  });

  it("shows two most urgent budgets, nearest incomplete goal, and tooltip-only details", async () => {
    const markup = renderToStaticMarkup(await BudgetsGoalsWidget({ options }));

    expect(markup).toContain("Rent");
    expect(markup).toContain("Groceries");
    expect(markup).not.toContain(">Other<");
    expect(markup).toContain("Emergency fund");
    expect(markup).not.toContain(">Holiday<");
    expect(markup).not.toContain(">Finished<");
    expect(markup).toContain('aria-label="Rent: Category; ₪1,500.00 spent of ₪1,000.00 budget; ₪500.00 over budget"');
    expect(markup).toContain('aria-label="Groceries: Subcategory; ₪400.00 spent of ₪500.00 budget; ₪100.00 remaining"');
    expect(markup).toContain(
      'aria-label="Emergency fund: ₪250.00 saved of ₪1,000.00 target; needed by 01/09/2026; Active; save ₪375.00 per month; ₪750.00 remaining"',
    );
    expect(markup).toContain("size-11");
    expect(markup).toContain("flex flex-1 flex-col justify-start gap-4");
    expect(markup).toContain("grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).not.toContain("Shared spending limits for your household.");
  });

  it("keeps overdue status in goal details while showing progress directly", async () => {
    mocks.getBudgetsGoalsData.mockResolvedValue({
      ...budgetsGoalsData,
      budgets: [],
      goals: [
        {
          ...budgetsGoalsData.goals[0],
          progress: {
            ...budgetsGoalsData.goals[0].progress,
            monthlyRequiredAgorot: null,
            remainingMonths: null,
            status: "overdue" as const,
          },
        },
      ],
    });

    const markup = renderToStaticMarkup(await BudgetsGoalsWidget({ options }));

    expect(markup).toContain(">25%<");
    expect(markup).not.toContain(">Overdue<");
    expect(markup).toContain("; Overdue; no monthly saving available;");
  });

  it("keeps cents in tooltip amounts", async () => {
    mocks.getBudgetsGoalsData.mockResolvedValue({
      ...budgetsGoalsData,
      budgets: [
        {
          ...budgetsGoalsData.budgets[0],
          monthlyBudget: 1234.56,
          spent: 1234.56,
          progress: {
            ...budgetsGoalsData.budgets[0].progress,
            percentage: 100,
            barPercentage: 100,
            overBudgetAgorot: 0,
            remainingAgorot: 0,
          },
        },
      ],
      goals: [],
    });

    const markup = renderToStaticMarkup(await BudgetsGoalsWidget({ options }));

    expect(markup).toContain('aria-label="Rent: Category; ₪1,234.56 spent of ₪1,234.56 budget; ₪0.00 remaining"');
  });

  it("keeps the dashboard widget concise when no budgets or goals exist", async () => {
    mocks.getBudgetsGoalsData.mockResolvedValue({ budgets: [], goals: [], targets: { categories: [], subcategories: [] } });

    const markup = renderToStaticMarkup(await BudgetsGoalsWidget({ options }));

    expect(markup).toContain("No budgets or goals yet.");
    expect(markup).toContain('href="/budgets-goals"');
    expect(markup).not.toContain('role="progressbar"');
  });

  it("keeps the dashboard headline amounts in the default foreground", async () => {
    const markup = renderToStaticMarkup(await DashboardMetricCards({ options }));

    expect([...markup.matchAll(/font-mono text-3xl font-semibold tabular-nums/g)]).toHaveLength(3);
    expect(markup).not.toContain("font-mono text-3xl font-semibold tabular-nums text-");
  });

  it("keeps fewer than three selected categories aggregated", async () => {
    mocks.getDashboardSpending.mockResolvedValue({
      categoryTotals: [
        { categoryId: "home-category-id", categoryName: "Home", amount: 3000 },
        { categoryId: "bills-category-id", categoryName: "Bills", amount: 1122 },
      ],
    });

    const markup = renderToStaticMarkup(
      await SpendingCard({ options: { month: "2026-07", spendingCategoryIds: ["home-category-id", "bills-category-id"] } as never }),
    );

    expect(markup).toContain("₪4,122");
    expect(markup).toContain('aria-label="Spending breakdown: Home ₪3,000, Bills ₪1,122"');
    expect(markup).toContain('fill="var(--analytics-bill-1)"');
    expect(markup).toContain('fill="var(--analytics-bill-2)"');
    expect(mocks.getDashboardSpending).toHaveBeenCalledTimes(1);
    expect(markup).not.toContain("<title>");
    expect(markup).not.toContain('aria-live="polite"');
    expect(markup).not.toContain("cursor-pointer");
    expect(markup).not.toContain('role="list"');
    expect(markup).not.toContain(">Total spending<");
  });

  it("defaults subcategory mode to all categories", async () => {
    mocks.getDashboardSpending.mockResolvedValue({
      categoryTotals: [
        { categoryId: "groceries", categoryName: "Groceries", amount: 100 },
        { categoryId: "arnona", categoryName: "Arnona", amount: 200 },
        { categoryId: "electricity", categoryName: "Electricity", amount: 300 },
      ],
    });

    const markup = renderToStaticMarkup(await SpendingCard({ options: { ...options, spendingGranularity: "subcategories" } }));

    expect(mocks.getDashboardSpending).toHaveBeenCalledTimes(1);
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
    const summaries = new Map([["2026-07-15", { balanceChangePercentage: 32, expenses: 7940, income: 16_400 }]]);
    mocks.getDashboardSummary.mockImplementation(async ({ range: requestedRange }: typeof rangeOptions) => ({
      ...summaries.get(requestedRange?.to ?? "2026-07-15"),
      expenseChangePercentage: -7.6,
      incomeChangePercentage: 12.5,
    }));

    const markup = renderToStaticMarkup(await DashboardMetricCards({ options: rangeOptions }));

    expect(mocks.getDashboardSummary).toHaveBeenCalledWith(rangeOptions);
    expect(mocks.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(markup).toContain("13% above previous 3 equivalent ranges");
    expect(markup).toContain("8% below previous 3 equivalent ranges");
    expect(markup).toContain("32% above previous 3 equivalent ranges");
  });

  it("ignores an impossible custom range", async () => {
    renderToStaticMarkup(await renderHome({ from: "2026-02-30", to: "2026-03-01" }));

    expect(mocks.getDashboardMonthlyReview).toHaveBeenCalledWith(expect.any(String));
  });
});
