import { beforeEach, expect, it, vi } from "vitest";

import { previousMonth } from "./date-range";

type Query = {
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

type Response = { data: unknown; error: unknown; reject?: unknown };
type QueryRecord = { filters: Array<{ column: string; method: string; value: unknown }>; select: string | null; table: string };

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentHouseholdContext: vi.fn(),
  queryRecords: [] as QueryRecord[],
  responses: {} as Record<string, Response>,
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

const { getBudgetsGoalsData } = await import("./budgets-goals-data");

const categoryRows = [
  { archived_at: null, color: "#ccebef", id: "food", kind: "expense", monthly_budget: 100, name: "Food", system_key: null },
  { archived_at: null, color: "#ffcff0", id: "home", kind: "expense", monthly_budget: null, name: "Home", system_key: null },
  {
    archived_at: "2026-01-01T00:00:00Z",
    color: "#f8d7d7",
    id: "archived",
    kind: "expense",
    monthly_budget: 250,
    name: "Archived",
    system_key: null,
  },
  { archived_at: null, color: "#efeffc", id: "income", kind: "income", monthly_budget: null, name: "Salary", system_key: "salary" },
];

const subcategoryRows = [
  { archived_at: null, category_id: "food", color: "#d9f0fa", id: "groceries", monthly_budget: 50, name: "Groceries" },
  { archived_at: null, category_id: "food", color: "#cadae0", id: "restaurants", monthly_budget: null, name: "Restaurants" },
  { archived_at: null, category_id: "home", color: "#ffbff4", id: "rent", monthly_budget: 700, name: "Rent" },
  { archived_at: "2026-01-01T00:00:00Z", category_id: "food", color: "#ced9e3", id: "old", monthly_budget: 25, name: "Old" },
  { archived_at: null, category_id: "income", color: "#e6d5e6", id: "bonus", monthly_budget: 10, name: "Bonus" },
];

const goalRows = [
  { id: "goal-later", name: "Later", saved_amount: 0, target_amount: 100, target_date: "2026-12-01" },
  { id: "goal-soon", name: "Soon", saved_amount: 50, target_amount: 100, target_date: "2026-09-01" },
  { id: "goal-complete", name: "Complete", saved_amount: 100, target_amount: 100, target_date: "2026-01-01" },
];

function query(table: string, response: Response): Query {
  const record: QueryRecord = { filters: [], select: null, table };
  mocks.queryRecords.push(record);
  const result = response.reject ? Promise.reject(response.reject) : Promise.resolve({ data: response.data, error: response.error });
  const builder = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: result.then.bind(result),
  } as unknown as Query;
  builder.eq.mockImplementation((column: string, value: unknown) => {
    record.filters.push({ column, method: "eq", value });
    return builder;
  });
  builder.order.mockImplementation((column: string, value: unknown) => {
    record.filters.push({ column, method: "order", value });
    return builder;
  });
  builder.select.mockImplementation((columns: string) => {
    record.select = columns;
    return builder;
  });
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryRecords.length = 0;
  for (const key of Object.keys(mocks.responses)) delete mocks.responses[key];
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    householdId: "household-id",
    role: "owner",
    status: "member",
    supabase: { from: mocks.from, rpc: mocks.rpc },
    userId: "user-id",
  });
  mocks.from.mockImplementation((table: string) =>
    query(
      table,
      mocks.responses[table] ?? {
        data: table === "categories" ? categoryRows : table === "subcategories" ? subcategoryRows : goalRows,
        error: null,
      },
    ),
  );
  mocks.rpc.mockImplementation((name: string, args: { p_subcategories?: boolean }) => {
    const key = args.p_subcategories ? "child-rpc" : "parent-rpc";
    const response = mocks.responses[key] ?? {
      data:
        name === "dashboard_spending_breakdown" && args.p_subcategories
          ? [
              { amount: 40, category_id: "groceries", category_name: "Groceries" },
              { amount: 5, category_id: "rent", category_name: "Rent" },
            ]
          : [{ amount: 80, category_id: "food", category_name: "Food" }],
      error: null,
    };
    return response.reject ? Promise.reject(response.reject) : Promise.resolve({ data: response.data, error: response.error });
  });
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
  expect(mocks.queryRecords).toEqual(
    expect.arrayContaining([
      {
        filters: [
          { column: "household_id", method: "eq", value: "household-id" },
          { column: "name", method: "order", value: undefined },
        ],
        select: "id, name, kind, color, system_key, archived_at, monthly_budget",
        table: "categories",
      },
      {
        filters: [
          { column: "household_id", method: "eq", value: "household-id" },
          { column: "name", method: "order", value: undefined },
        ],
        select: "id, name, color, category_id, archived_at, monthly_budget",
        table: "subcategories",
      },
      {
        filters: [{ column: "household_id", method: "eq", value: "household-id" }],
        select: "id, name, target_amount, saved_amount, target_date",
        table: "savings_goals",
      },
    ]),
  );
  expect(data.targets).toEqual({
    categories: [
      { color: "#ccebef", id: "food", label: "Food", monthlyBudget: 100, name: "Food", targetKind: "category" },
      { color: "#ffcff0", id: "home", label: "Home", monthlyBudget: null, name: "Home", targetKind: "category" },
    ],
    subcategories: [
      {
        categoryId: "food",
        categoryName: "Food",
        color: "#d9f0fa",
        id: "groceries",
        label: "Food · Groceries",
        monthlyBudget: 50,
        name: "Groceries",
        targetKind: "subcategory",
      },
      {
        categoryId: "food",
        categoryName: "Food",
        color: "#cadae0",
        id: "restaurants",
        label: "Food · Restaurants",
        monthlyBudget: null,
        name: "Restaurants",
        targetKind: "subcategory",
      },
      {
        categoryId: "home",
        categoryName: "Home",
        color: "#ffbff4",
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

it.each(["categories", "subcategories", "savings_goals"])("sanitizes a %s read error", async (table) => {
  mocks.responses[table] = { data: null, error: new Error(`${table} failed`) };

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
});

it.each(["categories", "subcategories", "savings_goals"])("sanitizes a %s read rejection", async (table) => {
  mocks.responses[table] = { data: null, error: null, reject: new Error(`${table} rejected`) };

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
});

it.each(["parent-rpc", "child-rpc"])("sanitizes a %s error", async (rpc) => {
  mocks.responses[rpc] = { data: null, error: new Error(`${rpc} failed`) };

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
});

it.each(["parent-rpc", "child-rpc"])("sanitizes a %s rejection", async (rpc) => {
  mocks.responses[rpc] = { data: null, error: null, reject: new Error(`${rpc} rejected`) };

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
});

it.each(["categories", "subcategories", "savings_goals", "parent-rpc", "child-rpc"])(
  "rejects a malformed null %s response",
  async (source) => {
    mocks.responses[source] = { data: null, error: null };

    await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
      new Error("Unable to load budgets and goals."),
    );
  },
);

it("accepts legitimate empty arrays from every read and RPC", async () => {
  mocks.responses.categories = { data: [], error: null };
  mocks.responses.subcategories = { data: [], error: null };
  mocks.responses.savings_goals = { data: [], error: null };
  mocks.responses["parent-rpc"] = { data: [], error: null };
  mocks.responses["child-rpc"] = { data: [], error: null };

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).resolves.toEqual({
    budgets: [],
    goals: [],
    targets: { categories: [], subcategories: [] },
  });
});

it("rejects a non-member context without querying financial data", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({ status: "unmatched" });

  await expect(getBudgetsGoalsData({ month: "2026-07", today: "2026-08-15" })).rejects.toEqual(
    new Error("Unable to load budgets and goals."),
  );
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
