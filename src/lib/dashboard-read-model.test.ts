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
        id: "occurrence-zero",
        kind: "expense",
        merchant: "Market",
        note: "Groceries",
        occurred_on: "2026-07-14",
        paid_by: "member-id",
        service_period_end: "2026-07-31",
        service_period_start: "2026-07-01",
        source: "manual",
        subcategory_id: "groceries",
        recurring_schedule_id: "schedule-id",
        recurring_transaction_schedules: { status: "active", cadence: "monthly", interval_count: 1 },
      },
      {
        amount: 125,
        category_id: null,
        created_at: "2026-07-21T08:00:00Z",
        id: "later-occurrence",
        kind: "expense",
        merchant: "Market",
        note: "Groceries",
        occurred_on: "2026-07-21",
        paid_by: "member-id",
        service_period_end: "2026-07-31",
        service_period_start: "2026-07-01",
        source: "manual",
        subcategory_id: "groceries",
        recurring_schedule_id: "schedule-id",
        recurring_transaction_schedules: { status: "active", cadence: "monthly", interval_count: 1 },
      },
    ]),
  };
});

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

import {
  getDashboardControls,
  getDashboardMonthlyReview,
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
    data: [
      {
        balance_change_percentage: 23.4,
        expense_change_percentage: -7.6,
        expenses: 7940,
        income: 16400,
        income_change_percentage: 12.5,
      },
    ],
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
    balanceChangePercentage: 23.4,
  });
  expect(mocks.rpc).toHaveBeenCalledWith("dashboard_summary", {
    p_month: "2026-07-01",
  });
});

it("maps a missing balance change percentage to null", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: [{ expense_change_percentage: -7.6, expenses: 7940, income: 16400, income_change_percentage: 12.5 }],
    error: null,
  });

  await expect(getDashboardSummary({ month: "2026-07" })).resolves.toEqual({
    expenseChangePercentage: -7.6,
    expenses: 7940,
    income: 16400,
    incomeChangePercentage: 12.5,
    balanceChangePercentage: null,
  });
});

it("maps the bounded monthly review projection", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: [{ expenses: 8000, income: 12000, month: "2026-07-01", savings: 4000 }],
    error: null,
  });

  await expect(getDashboardMonthlyReview("2026-07")).resolves.toEqual([
    { expenses: 8000, income: 12000, month: "2026-07-01", savings: 4000 },
  ]);
  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "dashboard_monthly_review", { p_month: "2026-07-01" });
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
  mocks.rpc.mockResolvedValueOnce({ data: [{ amount: 4280, category_id: "food", category_name: "Food" }], error: null });

  await expect(getDashboardSpending({ month: "2026-07" })).resolves.toEqual({
    categoryTotals: [{ amount: 4280, categoryId: "food", categoryName: "Food" }],
  });
  expect(mocks.rpc).toHaveBeenCalledWith("dashboard_spending_breakdown", {
    p_month: "2026-07-01",
    p_subcategories: false,
  });
});

it("keeps the Supabase client context when loading spending", async () => {
  const rest = vi.fn().mockResolvedValue({
    data: [{ amount: 4280, category_id: "food", category_name: "Food" }],
    error: null,
  });
  const supabase = {
    rest,
    rpc(this: { rest: typeof rest }, functionName: string, args: Record<string, unknown>) {
      return this.rest(functionName, args);
    },
  };
  mocks.getCurrentHouseholdContext.mockResolvedValueOnce({
    status: "member",
    householdId: "household-id",
    userId: "member-id",
    role: "owner",
    supabase,
  });

  await expect(getDashboardSpending({ month: "2026-07" })).resolves.toEqual({
    categoryTotals: [{ amount: 4280, categoryId: "food", categoryName: "Food" }],
  });
});

it("passes a selected category to the authenticated spending projection", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [{ amount: 4280, category_id: "groceries", category_name: "Groceries" }], error: null });

  await expect(getDashboardSpending({ month: "2026-07", spendingCategoryIds: ["food"] })).resolves.toEqual({
    categoryTotals: [{ amount: 4280, categoryId: "groceries", categoryName: "Groceries" }],
  });
  expect(mocks.rpc).toHaveBeenCalledWith("dashboard_spending_breakdown", {
    p_category_ids: ["food"],
    p_month: "2026-07-01",
    p_subcategories: false,
  });
});

it("projects canonical recurring status and cadence for the anchor and later occurrences", async () => {
  const data = await getLedgerData({ month: "2026-07" });

  expect(mocks.selects.transactions).toHaveBeenCalledWith(
    "id, kind, amount, occurred_on, merchant, note, category_id, subcategory_id, service_period_start, service_period_end, source, created_at, paid_by, recurring_schedule_id, recurring_transaction_schedules!transactions_recurring_schedule_id_fkey(status, cadence, interval_count)",
  );
  expect(mocks.transactions.gte).toHaveBeenCalledWith("occurred_on", "2026-07-01");
  expect(mocks.transactions.lte).toHaveBeenCalledWith("occurred_on", "2026-07-31");
  expect(mocks.from).not.toHaveBeenCalledWith("recurring_transaction_schedules");
  expect(data.transactions).toEqual([
    expect.objectContaining({
      amount: 125,
      id: "occurrence-zero",
      occurredOn: "2026-07-14",
      recurringScheduleId: "schedule-id",
      recurringScheduleStatus: "active",
      recurrenceCadence: "monthly",
      recurrenceInterval: 1,
      servicePeriodEnd: "2026-07-31",
      servicePeriodStart: "2026-07-01",
    }),
    expect.objectContaining({
      id: "later-occurrence",
      recurringScheduleId: "schedule-id",
      recurringScheduleStatus: "active",
      recurrenceCadence: "monthly",
      recurrenceInterval: 1,
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
