import { beforeEach, expect, it, vi } from "vitest";

import { previousMonth } from "./date-range";

type Query = {
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentHouseholdContext: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

const { getBudgetsGoalsData } = await import("./budgets-goals-data");

const categoryRows = [
  { archived_at: null, id: "food", kind: "expense", monthly_budget: 100, name: "Food" },
  { archived_at: null, id: "home", kind: "expense", monthly_budget: null, name: "Home" },
  { archived_at: "2026-01-01T00:00:00Z", id: "archived", kind: "expense", monthly_budget: 250, name: "Archived" },
  { archived_at: null, id: "income", kind: "income", monthly_budget: null, name: "Salary" },
];

const subcategoryRows = [
  { archived_at: null, category_id: "food", id: "groceries", monthly_budget: 50, name: "Groceries" },
  { archived_at: null, category_id: "food", id: "restaurants", monthly_budget: null, name: "Restaurants" },
  { archived_at: null, category_id: "home", id: "rent", monthly_budget: 700, name: "Rent" },
  { archived_at: "2026-01-01T00:00:00Z", category_id: "food", id: "old", monthly_budget: 25, name: "Old" },
  { archived_at: null, category_id: "income", id: "bonus", monthly_budget: 10, name: "Bonus" },
];

const goalRows = [
  { id: "goal-later", name: "Later", saved_amount: 0, target_amount: 100, target_date: "2026-12-01" },
  { id: "goal-soon", name: "Soon", saved_amount: 50, target_amount: 100, target_date: "2026-09-01" },
  { id: "goal-complete", name: "Complete", saved_amount: 100, target_amount: 100, target_date: "2026-01-01" },
];

function query(data: unknown): Query {
  const result = Promise.resolve({ data, error: null });
  const builder = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: result.then.bind(result),
  } as unknown as Query;
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    householdId: "household-id",
    role: "owner",
    status: "member",
    supabase: { from: mocks.from, rpc: mocks.rpc },
    userId: "user-id",
  });
  mocks.from.mockImplementation((table: string) =>
    table === "categories" ? query(categoryRows) : table === "subcategories" ? query(subcategoryRows) : query(goalRows),
  );
  mocks.rpc.mockImplementation((name: string, args: { p_subcategories?: boolean }) =>
    Promise.resolve({
      data:
        name === "dashboard_spending_breakdown" && args.p_subcategories
          ? [
              { amount: 40, category_id: "groceries", category_name: "Groceries" },
              { amount: 5, category_id: "rent", category_name: "Rent" },
            ]
          : [{ amount: 80, category_id: "food", category_name: "Food" }],
      error: null,
    }),
  );
});

it("loads active targets, independent parent and child progress, and sorted goals", async () => {
  const data = await getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" });

  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "dashboard_spending_breakdown", {
    p_month: "2026-07-01",
    p_subcategories: false,
  });
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "dashboard_spending_breakdown", {
    p_month: "2026-07-01",
    p_subcategories: true,
  });
  expect(data.targets).toEqual({
    categories: [
      { id: "food", label: "Food", monthlyBudget: 100, name: "Food", targetKind: "category" },
      { id: "home", label: "Home", monthlyBudget: null, name: "Home", targetKind: "category" },
    ],
    subcategories: [
      {
        categoryId: "food",
        categoryName: "Food",
        id: "groceries",
        label: "Food · Groceries",
        monthlyBudget: 50,
        name: "Groceries",
        targetKind: "subcategory",
      },
      {
        categoryId: "food",
        categoryName: "Food",
        id: "restaurants",
        label: "Food · Restaurants",
        monthlyBudget: null,
        name: "Restaurants",
        targetKind: "subcategory",
      },
      {
        categoryId: "home",
        categoryName: "Home",
        id: "rent",
        label: "Home · Rent",
        monthlyBudget: 700,
        name: "Rent",
        targetKind: "subcategory",
      },
    ],
  });
  expect(data.budgets).toEqual([
    expect.objectContaining({ id: "food", label: "Food", monthlyBudget: 100, spent: 80, targetKind: "category" }),
    expect.objectContaining({ id: "groceries", label: "Food · Groceries", monthlyBudget: 50, spent: 40, targetKind: "subcategory" }),
    expect.objectContaining({ id: "rent", label: "Home · Rent", monthlyBudget: 700, spent: 5, targetKind: "subcategory" }),
  ]);
  expect(data.budgets.find((budget) => budget.id === "rent")?.progress.spentAgorot).toBe(500);
  expect(data.goals.map((goal) => goal.id)).toEqual(["goal-soon", "goal-later", "goal-complete"]);
  expect(data.goals[0].progress.monthlyRequiredAgorot).toBe(5000);
});

it("passes dashboard ranges and zero-fills missing spending totals", async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });

  const data = await getBudgetsGoalsData({
    month: "2026-07",
    range: { from: "2026-07-10", to: "2026-07-20" },
    today: "2026-08-15",
  });

  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "dashboard_spending_breakdown", {
    p_month: "2026-07-01",
    p_range_from: "2026-07-10",
    p_range_to: "2026-07-20",
    p_subcategories: false,
  });
  expect(data.budgets[0]).toMatchObject({ id: "food", spent: 0 });
  expect(data.budgets[0].progress.spentAgorot).toBe(0);
});

it("defaults to the previous completed month", async () => {
  await getBudgetsGoalsData({ today: "2026-08-15" });

  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "dashboard_spending_breakdown", {
    p_month: `${previousMonth()}-01`,
    p_subcategories: false,
  });
});

it("maps every read or RPC failure to the sanitized error", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("database failure") });

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
});

it("rejects a non-member context without querying financial data", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({ status: "unmatched" });

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
