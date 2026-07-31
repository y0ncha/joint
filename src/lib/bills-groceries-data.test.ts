import { beforeEach, expect, it, vi } from "vitest";

type QueryRecord = {
  filters: Array<{ method: string; column: string; value: unknown }>;
  select: string | null;
  table: string;
  terminal: string | null;
};

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  getDashboardData: vi.fn(() => {
    throw new Error("BillsGroceries must not call getDashboardData().");
  }),
  from: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));

const billsGroceriesDataModule = await import("./bills-groceries-data");

const options = {
  currentDate: "2026-07-31",
  period: "rolling" as const,
  groceryRange: { from: "2026-07-01", to: "2026-07-31" },
};

const queries: QueryRecord[] = [];
let respond: (query: QueryRecord) => { data: unknown; error: unknown };

function queryFor(table: string) {
  const record: QueryRecord = { filters: [], select: null, table, terminal: null };
  queries.push(record);
  const query = {
    select(columns: string) {
      record.select = columns;
      return query;
    },
    eq(column: string, value: unknown) {
      record.filters.push({ method: "eq", column, value });
      return query;
    },
    in(column: string, value: unknown[]) {
      record.filters.push({ method: "in", column, value });
      return query;
    },
    is(column: string, value: unknown) {
      record.filters.push({ method: "is", column, value });
      return query;
    },
    gte(column: string, value: unknown) {
      record.filters.push({ method: "gte", column, value });
      return query;
    },
    lte(column: string, value: unknown) {
      record.filters.push({ method: "lte", column, value });
      return query;
    },
    order(column: string) {
      record.filters.push({ method: "order", column, value: null });
      return query;
    },
    maybeSingle() {
      record.terminal = "maybeSingle";
      return Promise.resolve(respond(record));
    },
    then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(respond(record)).then(onfulfilled, onrejected);
    },
  };
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  queries.length = 0;
  respond = () => ({ data: [], error: null });
  mocks.from.mockImplementation(queryFor);
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    supabase: { from: mocks.from },
    userId: "member-id",
    householdId: "household-id",
    role: "owner",
  });
});

it.each(["unauthenticated", "unmatched"] as const)(
  "rejects the %s context with the dashboard no-household error before querying",
  async (status) => {
    mocks.getCurrentHouseholdContext.mockResolvedValue({ status });

    await expect(billsGroceriesDataModule.getBillsGroceriesData(options)).rejects.toEqual(
      new Error("Create or join a household before viewing the dashboard."),
    );
    expect(mocks.from).not.toHaveBeenCalled();
  },
);

it("resolves active protected categories in the member household and returns compact empty chart states", async () => {
  respond = (query) =>
    query.table === "households" ? { data: { groceries_monthly_budget: null }, error: null } : { data: null, error: null };

  const data = await billsGroceriesDataModule.getBillsGroceriesData(options);

  expect(queries).toEqual([
    {
      table: "households",
      select: "groceries_monthly_budget",
      filters: [{ method: "eq", column: "id", value: "household-id" }],
      terminal: "maybeSingle",
    },
    {
      table: "categories",
      select: "id, name, color",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "eq", column: "system_key", value: "bills" },
        { method: "is", column: "archived_at", value: null },
      ],
      terminal: "maybeSingle",
    },
    {
      table: "categories",
      select: "id, name, color",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "eq", column: "system_key", value: "groceries" },
        { method: "is", column: "archived_at", value: null },
      ],
      terminal: "maybeSingle",
    },
  ]);
  expect(data.months).toEqual([
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
  ]);
  expect(data.bills).toEqual({
    category: null,
    subcategories: [],
    monthly: [],
    defaultSubcategoryId: null,
    yearOverYear: [],
  });
  expect(data.groceries).toMatchObject({
    category: null,
    subcategories: { mainRun: null, topUps: null },
    monthly: {
      budgetAgorot: null,
      months: [
        { month: "2025-08", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2025-09", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2025-10", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2025-11", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2025-12", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-01", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-02", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-03", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-04", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-05", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-06", mainRunAgorot: 0, topUpsAgorot: 0 },
        { month: "2026-07", mainRunAgorot: 0, topUpsAgorot: 0 },
      ],
    },
  });
  expect(data.groceries.daily).toHaveLength(31);
  expect([data.groceries.daily[0], data.groceries.daily[30]]).toEqual([
    { date: "2026-07-01", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
    { date: "2026-07-31", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
  ]);
  expect(mocks.getDashboardData).not.toHaveBeenCalled();
  expect(queries.some((query) => query.table === "transactions")).toBe(false);
});

it("loads only bounded chart columns and projects current and previous-year BillsGroceries series", async () => {
  respond = (query) => {
    if (query.table === "households") return { data: { groceries_monthly_budget: 500 }, error: null };
    if (query.table === "categories") {
      const systemKey = query.filters.find((filter) => filter.column === "system_key")?.value;
      return {
        data:
          systemKey === "bills"
            ? { id: "bills-id", name: "Bills", color: "#112233" }
            : { id: "groceries-id", name: "Groceries", color: "#445566" },
        error: null,
      };
    }
    if (query.table === "subcategories") {
      const categoryId = query.filters.find((filter) => filter.column === "category_id")?.value;
      return categoryId === "bills-id"
        ? {
            data: [
              { id: "electricity", name: "Electricity", color: "#abcdef" },
              { id: "water", name: "Water", color: "#fedcba" },
            ],
            error: null,
          }
        : {
            data: [
              { id: "main-run", name: "Main run", color: "#aabbcc", system_key: "main_run" },
              { id: "top-ups", name: "Top-ups", color: "#ccbbaa", system_key: "top_ups" },
            ],
            error: null,
          };
    }
    if (query.table === "transactions" && query.select?.includes("service_period_start")) {
      return {
        data: [
          {
            amount: 80,
            subcategory_id: "electricity",
            service_period_start: "2025-07-31",
            service_period_end: "2025-07-31",
          },
          {
            amount: 100,
            subcategory_id: "electricity",
            service_period_start: "2026-07-31",
            service_period_end: "2026-07-31",
          },
        ],
        error: null,
      };
    }
    if (query.table === "transactions") {
      const from = query.filters.find((filter) => filter.method === "gte" && filter.column === "occurred_on")?.value;
      return {
        data:
          from === "2025-08-01"
            ? [
                { amount: 10, occurred_on: "2025-08-01", subcategory_id: "main-run" },
                { amount: 12.34, occurred_on: "2026-07-01", subcategory_id: "main-run" },
                { amount: 2.5, occurred_on: "2026-07-01", subcategory_id: "top-ups" },
                { amount: 5, occurred_on: "2026-07-31", subcategory_id: "top-ups" },
              ]
            : [
                { amount: 12.34, occurred_on: "2026-07-01", subcategory_id: "main-run" },
                { amount: 2.5, occurred_on: "2026-07-01", subcategory_id: "top-ups" },
                { amount: 5, occurred_on: "2026-07-31", subcategory_id: "top-ups" },
              ],
        error: null,
      };
    }
    return { data: [], error: null };
  };

  const data = await billsGroceriesDataModule.getBillsGroceriesData(options);

  expect(queries.slice(3)).toEqual([
    {
      table: "subcategories",
      select: "id, name, color",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "eq", column: "category_id", value: "bills-id" },
        { method: "is", column: "archived_at", value: null },
        { method: "order", column: "name", value: null },
      ],
      terminal: null,
    },
    {
      table: "subcategories",
      select: "id, name, color, system_key",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "eq", column: "category_id", value: "groceries-id" },
        { method: "in", column: "system_key", value: ["main_run", "top_ups"] },
        { method: "is", column: "archived_at", value: null },
        { method: "order", column: "name", value: null },
      ],
      terminal: null,
    },
    {
      table: "transactions",
      select: "amount, subcategory_id, service_period_start, service_period_end",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "in", column: "subcategory_id", value: ["electricity", "water"] },
        { method: "lte", column: "service_period_start", value: "2026-07-31" },
        { method: "gte", column: "service_period_end", value: "2024-08-01" },
      ],
      terminal: null,
    },
    {
      table: "transactions",
      select: "amount, occurred_on, subcategory_id",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "in", column: "subcategory_id", value: ["main-run", "top-ups"] },
        { method: "gte", column: "occurred_on", value: "2025-08-01" },
        { method: "lte", column: "occurred_on", value: "2026-07-31" },
      ],
      terminal: null,
    },
    {
      table: "transactions",
      select: "amount, occurred_on, subcategory_id",
      filters: [
        { method: "eq", column: "household_id", value: "household-id" },
        { method: "in", column: "subcategory_id", value: ["main-run", "top-ups"] },
        { method: "gte", column: "occurred_on", value: "2026-07-01" },
        { method: "lte", column: "occurred_on", value: "2026-07-31" },
      ],
      terminal: null,
    },
  ]);
  expect(data.bills).toEqual({
    category: { id: "bills-id", name: "Bills", color: "#112233" },
    subcategories: [
      { id: "electricity", name: "Electricity", color: "#abcdef" },
      { id: "water", name: "Water", color: "#fedcba" },
    ],
    monthly: [
      { month: "2025-07", subcategoryId: "electricity", agorot: 8000 },
      { month: "2026-07", subcategoryId: "electricity", agorot: 10000 },
    ],
    defaultSubcategoryId: "electricity",
    yearOverYear: [
      { month: "2025-08", currentAgorot: 0 },
      { month: "2025-09", currentAgorot: 0 },
      { month: "2025-10", currentAgorot: 0 },
      { month: "2025-11", currentAgorot: 0 },
      { month: "2025-12", currentAgorot: 0 },
      { month: "2026-01", currentAgorot: 0 },
      { month: "2026-02", currentAgorot: 0 },
      { month: "2026-03", currentAgorot: 0 },
      { month: "2026-04", currentAgorot: 0 },
      { month: "2026-05", currentAgorot: 0 },
      { month: "2026-06", currentAgorot: 0 },
      { month: "2026-07", currentAgorot: 10000, previousAgorot: 8000 },
    ],
  });
  expect(data.groceries).toMatchObject({
    category: { id: "groceries-id", name: "Groceries", color: "#445566" },
    subcategories: {
      mainRun: { id: "main-run", name: "Main run", color: "#aabbcc" },
      topUps: { id: "top-ups", name: "Top-ups", color: "#ccbbaa" },
    },
    monthly: {
      budgetAgorot: 50000,
      months: expect.arrayContaining([
        { month: "2025-08", mainRunAgorot: 1000, topUpsAgorot: 0 },
        { month: "2026-07", mainRunAgorot: 1234, topUpsAgorot: 750 },
      ]),
    },
  });
  expect([data.groceries.daily[0], data.groceries.daily[30]]).toEqual([
    { date: "2026-07-01", mainRunAgorot: 1234, topUpsAgorot: 250, totalAgorot: 1484 },
    { date: "2026-07-31", mainRunAgorot: 0, topUpsAgorot: 500, totalAgorot: 500 },
  ]);
  expect(mocks.getDashboardData).not.toHaveBeenCalled();
  expect(data).not.toHaveProperty("transactions");
});

it.each(["households", "categories", "subcategories", "transactions"])(
  "surfaces a %s query error as an BillsGroceries load failure",
  async (failingTable) => {
    respond = (query) => {
      if (query.table === failingTable) return { data: null, error: new Error("query failed") };
      if (query.table === "households") return { data: { groceries_monthly_budget: null }, error: null };
      if (query.table === "categories") {
        const systemKey = query.filters.find((filter) => filter.column === "system_key")?.value;
        return { data: { id: `${systemKey}-id`, name: String(systemKey), color: "#112233" }, error: null };
      }
      if (query.table === "subcategories") {
        const categoryId = query.filters.find((filter) => filter.column === "category_id")?.value;
        return categoryId === "bills-id"
          ? { data: [{ id: "electricity", name: "Electricity", color: "#abcdef" }], error: null }
          : {
              data: [
                { id: "main-run", name: "Main run", color: "#aabbcc", system_key: "main_run" },
                { id: "top-ups", name: "Top-ups", color: "#ccbbaa", system_key: "top_ups" },
              ],
              error: null,
            };
      }
      return { data: [], error: null };
    };

    await expect(billsGroceriesDataModule.getBillsGroceriesData(options)).rejects.toThrow("Unable to load BillsGroceries data.");
  },
);

it("uses calendar-year monthly bounds and the matching previous-year Bills comparison range", async () => {
  respond = (query) => {
    if (query.table === "households") return { data: { groceries_monthly_budget: null }, error: null };
    if (query.table === "categories") {
      const systemKey = query.filters.find((filter) => filter.column === "system_key")?.value;
      return { data: { id: `${systemKey}-id`, name: String(systemKey), color: "#112233" }, error: null };
    }
    if (query.table === "subcategories") {
      const categoryId = query.filters.find((filter) => filter.column === "category_id")?.value;
      return categoryId === "bills-id"
        ? { data: [{ id: "electricity", name: "Electricity", color: "#abcdef" }], error: null }
        : {
            data: [
              { id: "main-run", name: "Main run", color: "#aabbcc", system_key: "main_run" },
              { id: "top-ups", name: "Top-ups", color: "#ccbbaa", system_key: "top_ups" },
            ],
            error: null,
          };
    }
    return { data: [], error: null };
  };

  const data = await billsGroceriesDataModule.getBillsGroceriesData({ ...options, period: "calendar" });
  const transactionQueries = queries.filter((query) => query.table === "transactions");

  expect(data.months).toEqual([
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
  ]);
  expect(transactionQueries[0].filters).toEqual([
    { method: "eq", column: "household_id", value: "household-id" },
    { method: "in", column: "subcategory_id", value: ["electricity"] },
    { method: "lte", column: "service_period_start", value: "2026-12-31" },
    { method: "gte", column: "service_period_end", value: "2025-01-01" },
  ]);
  expect(transactionQueries[1].filters).toEqual([
    { method: "eq", column: "household_id", value: "household-id" },
    { method: "in", column: "subcategory_id", value: ["main-run", "top-ups"] },
    { method: "gte", column: "occurred_on", value: "2026-01-01" },
    { method: "lte", column: "occurred_on", value: "2026-12-31" },
  ]);
});
