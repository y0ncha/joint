import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  function query(data: unknown[] = []) {
    const result = Promise.resolve({ data, error: null });
    const builder = {
      eq: vi.fn(),
      gte: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      then: result.then.bind(result),
    };
    for (const method of [builder.eq, builder.gte, builder.in, builder.is, builder.lte, builder.or, builder.order]) {
      method.mockReturnValue(builder);
    }
    return builder;
  }

  return {
    categories: query([
      {
        archived_at: null,
        color: "#D96B6B",
        icon: "utensils",
        id: "food",
        kind: "expense",
        name: "Food",
        system_key: null,
      },
    ]),
    from: vi.fn(),
    getCurrentHouseholdContext: vi.fn(),
    members: query([{ color: "#dcece3", profiles: { full_name: "Ada Lovelace" }, user_id: "member-id" }]),
    rpc: vi.fn(),
    schedules: query([]),
    selects: {
      categories: vi.fn(),
      members: vi.fn(),
      schedules: vi.fn(),
      subcategories: vi.fn(),
      transactions: vi.fn(),
    },
    subcategories: query([
      {
        archived_at: null,
        category_id: "food",
        color: "#D8F0D0",
        icon: null,
        id: "groceries",
        name: "Groceries",
        system_key: null,
      },
    ]),
    transactions: query([
      {
        amount: 125,
        category_id: null,
        created_at: "2026-07-14T08:00:00Z",
        id: "transaction-id",
        kind: "expense",
        merchant: "Market",
        note: "Groceries",
        occurred_on: "2026-07-14",
        paid_by: "member-id",
        service_period_end: "2026-07-31",
        service_period_start: "2026-07-01",
        source: "manual",
        subcategory_id: "groceries",
      },
    ]),
  };
});

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

import {
  getDashboardBalance,
  getDashboardControls,
  getDashboardRecentActivity,
  getDashboardSpending,
  getDashboardSummary,
  getLedgerData,
} from "./dashboard-read-model";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    householdId: "household-id",
    userId: "member-id",
    role: "owner",
    supabase: { from: mocks.from, rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({
    data: [{ expense_change_percentage: -7.6, expenses: 7940, income: 16400, income_change_percentage: 12.5 }],
    error: null,
  });
  mocks.from.mockImplementation((table: string) => ({
    select: (table === "household_members"
      ? mocks.selects.members
      : table === "recurring_transaction_schedules"
        ? mocks.selects.schedules
        : mocks.selects[table as "categories" | "subcategories" | "transactions"]
    ).mockReturnValue(
      table === "categories"
        ? mocks.categories
        : table === "subcategories"
          ? mocks.subcategories
          : table === "household_members"
            ? mocks.members
            : table === "transactions"
              ? mocks.transactions
              : mocks.schedules,
    ),
  }));
});

it("requests the summary projection without a browser-controlled household id", async () => {
  await expect(getDashboardSummary({ month: "2026-07" })).resolves.toEqual({
    expenseChangePercentage: -7.6,
    expenses: 7940,
    income: 16400,
    incomeChangePercentage: 12.5,
  });
  expect(mocks.rpc).toHaveBeenCalledWith("dashboard_summary", {
    p_month: "2026-07-01",
    p_range_from: null,
    p_range_to: null,
  });
});

it("loads only the category, subcategory, and member controls", async () => {
  await expect(getDashboardControls()).resolves.toMatchObject({
    categories: [{ id: "food", name: "Food" }],
    currentUserId: "member-id",
    directCategories: [],
    members: [{ color: "#dcece3", id: "member-id", label: "Ada Lovelace" }],
    subcategories: [{ categoryId: "food", categoryName: "Food", icon: "utensils", name: "Groceries" }],
  });
  expect(mocks.from).not.toHaveBeenCalledWith("transactions");
});

it("maps each focused dashboard projection to the existing report names", async () => {
  mocks.rpc
    .mockResolvedValueOnce({ data: [{ amount: 4280, category_id: "food", category_name: "Food" }], error: null })
    .mockResolvedValueOnce({ data: [{ expected_monthly_income: 18000, expenses: 7940, shared_balance: 18420 }], error: null })
    .mockResolvedValueOnce({
      data: [
        {
          amount: 186,
          category_name: "Food",
          id: "activity-id",
          kind: "expense",
          merchant: "Market",
          note: "Groceries",
          occurred_on: "2026-07-14",
          source: "statement_import",
          subcategory_name: "Groceries",
        },
      ],
      error: null,
    });

  await expect(getDashboardSpending({ month: "2026-07" })).resolves.toEqual({
    categoryTotals: [{ amount: 4280, categoryId: "food", categoryName: "Food" }],
  });
  await expect(getDashboardBalance({ month: "2026-07" })).resolves.toEqual({
    expectedMonthlyIncome: 18000,
    expenses: 7940,
    sharedBalance: 18420,
  });
  await expect(getDashboardRecentActivity({ month: "2026-07" })).resolves.toEqual({
    transactions: [
      {
        amount: 186,
        categoryName: "Food",
        id: "activity-id",
        kind: "expense",
        merchant: "Market",
        note: "Groceries",
        occurredOn: "2026-07-14",
        source: "statement_import",
        subcategoryName: "Groceries",
      },
    ],
  });
});

it("passes a selected category to the authenticated spending projection", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [{ amount: 4280, category_id: "groceries", category_name: "Groceries" }], error: null });

  await expect(getDashboardSpending({ month: "2026-07", spendingCategoryId: "food" })).resolves.toEqual({
    categoryTotals: [{ amount: 4280, categoryId: "groceries", categoryName: "Groceries" }],
  });
  expect(mocks.rpc).toHaveBeenCalledWith("dashboard_spending", {
    p_category_id: "food",
    p_month: "2026-07-01",
    p_range_from: null,
    p_range_to: null,
  });
});

it("does not return more than five activity rows", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: Array.from({ length: 5 }, (_, index) => ({
      amount: 100 + index,
      category_name: "Food",
      id: `activity-${index}`,
      kind: "expense",
      merchant: "Market",
      note: "Groceries",
      occurred_on: `2026-07-${String(14 - index).padStart(2, "0")}`,
      source: "manual",
      subcategory_name: "Groceries",
    })),
    error: null,
  });

  expect((await getDashboardRecentActivity({ month: "2026-07" })).transactions).toHaveLength(5);
});

it("loads recurring schedules in parallel with bounded ledger rows", async () => {
  const data = await getLedgerData({ month: "2026-07" });

  expect(mocks.selects.transactions).toHaveBeenCalledWith(
    "id, kind, amount, occurred_on, merchant, note, category_id, subcategory_id, service_period_start, service_period_end, source, created_at, paid_by",
  );
  expect(mocks.transactions.gte).toHaveBeenCalledWith("occurred_on", "2026-07-01");
  expect(mocks.transactions.lte).toHaveBeenCalledWith("occurred_on", "2026-07-31");
  expect(mocks.selects.schedules).toHaveBeenCalledWith("id, amount, cadence, enabled, merchant, next_occurs_on, note, interval_count");
  expect(data.transactions).toEqual([
    expect.objectContaining({
      amount: 125,
      id: "transaction-id",
      occurredOn: "2026-07-14",
      servicePeriodEnd: "2026-07-31",
      servicePeriodStart: "2026-07-01",
    }),
  ]);
});

it("applies valid ledger filters and sort before rows cross the server seam", async () => {
  const data = await getLedgerData({
    categoryIds: ["food", "unknown"],
    filterKind: "expense",
    month: "2026-07",
    paidByIds: ["member-id", "unassigned", "unknown"],
    sort: "amount-desc",
  });

  expect(mocks.transactions.eq).toHaveBeenCalledWith("kind", "expense");
  expect(mocks.transactions.or).toHaveBeenCalledWith("category_id.in.(food),subcategory_id.in.(groceries)");
  expect(mocks.transactions.or).toHaveBeenCalledWith("paid_by.in.(member-id),paid_by.is.null");
  expect(mocks.transactions.order).toHaveBeenNthCalledWith(1, "amount", { ascending: false });
  expect(data).toMatchObject({ categoryIds: ["food"], paidByIds: ["member-id", "unassigned"] });
});
