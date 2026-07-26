import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildMonthlyReport: vi.fn(),
  buildRangeReport: vi.fn(),
  getCurrentHouseholdContext: vi.fn(),
  from: vi.fn(),
  householdEq: vi.fn(),
  categoriesEq: vi.fn(),
  subcategoriesEq: vi.fn(),
  transactionsEq: vi.fn(),
  membersEq: vi.fn(),
}));

vi.mock("@/lib/financial-report", () => ({
  buildMonthlyReport: mocks.buildMonthlyReport,
  buildRangeReport: mocks.buildRangeReport,
}));
vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

const dashboardDataModule = await import("./dashboard-data");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    supabase: { from: mocks.from },
    userId: "member-id",
    householdId: "household-id",
    role: "owner",
  });
  mocks.buildMonthlyReport.mockReturnValue({ sharedBalance: 9275.5 });
  mocks.buildRangeReport.mockReturnValue({ sharedBalance: 9275.5 });
  mocks.from.mockImplementation((table) => {
    if (table === "accounts") throw new Error("Dashboard loading must not query accounts.");
    const result =
      table === "households"
        ? { data: { opening_balance: "9000.50" }, error: null }
        : table === "categories"
          ? { data: [{ id: "food", name: "Food", kind: "expense", color: "#D96B6B", archived_at: null }], error: null }
          : table === "subcategories"
            ? { data: [{ id: "groceries", name: "Groceries", category_id: "food", archived_at: null }], error: null }
            : table === "transactions"
              ? {
                  data: [
                    {
                      id: "transaction-id",
                      kind: "expense",
                      amount: "125",
                      occurred_on: "2026-07-14",
                      subcategory_id: null,
                      note: "Statement note",
                      merchant: "Super Pharm",
                      source: "statement_import",
                      created_at: "2026-07-14T08:00:00Z",
                      paid_by: null,
                    },
                  ],
                  error: null,
                }
              : { data: [{ user_id: "member-id", role: "owner" }], error: null };
    const query = { order: vi.fn().mockResolvedValue(result) };
    const eq =
      table === "households"
        ? mocks.householdEq
        : table === "categories"
          ? mocks.categoriesEq
          : table === "subcategories"
            ? mocks.subcategoriesEq
            : table === "transactions"
              ? mocks.transactionsEq
              : mocks.membersEq;
    eq.mockReturnValue(table === "households" ? { single: vi.fn().mockResolvedValue(result) } : query);
    return { select: vi.fn(() => ({ eq })) };
  });
});

it("loads the household opening balance through the member request context", async () => {
  const data = await dashboardDataModule.getDashboardData("2026-07");

  expect(data).toMatchObject({ report: { sharedBalance: 9275.5 }, currentUserId: "member-id" });
  expect(data).not.toHaveProperty("accounts");
  expect(data).not.toHaveProperty("setupRequired");
  expect(mocks.buildMonthlyReport).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 9000.5, month: "2026-07" }));
  expect(mocks.from).toHaveBeenCalledWith("households");
  expect(mocks.householdEq).toHaveBeenCalledWith("id", "household-id");
  expect(mocks.categoriesEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.subcategoriesEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.transactionsEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.membersEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.from).not.toHaveBeenCalledWith("accounts");
});

it("loads inherited subcategory data and passes hierarchy-aware transactions to monthly reports", async () => {
  const data = await dashboardDataModule.getDashboardData("2026-07");

  expect(data.subcategories).toEqual([
    {
      id: "groceries",
      name: "Groceries",
      categoryId: "food",
      archivedAt: null,
      categoryName: "Food",
      kind: "expense",
      color: "#D96B6B",
      categoryArchivedAt: null,
    },
  ]);

  expect(mocks.buildMonthlyReport).toHaveBeenCalledWith(
    expect.objectContaining({
      categories: [expect.objectContaining({ id: "food", color: "#D96B6B" })],
      subcategories: [expect.objectContaining({ id: "groceries", categoryId: "food" })],
      transactions: [
        expect.objectContaining({
          subcategoryId: null,
          paidBy: null,
          merchant: "Super Pharm",
          source: "statement_import",
        }),
      ],
    }),
  );
});

it("passes categories, subcategories, and transactions to range reports", async () => {
  await dashboardDataModule.getDashboardData("2026-07", { from: "2026-07-01", to: "2026-07-31" });

  expect(mocks.buildRangeReport).toHaveBeenCalledWith(
    expect.objectContaining({
      categories: [expect.objectContaining({ id: "food" })],
      subcategories: [expect.objectContaining({ id: "groceries", categoryId: "food" })],
      transactions: [expect.objectContaining({ subcategoryId: null, merchant: "Super Pharm", paidBy: null })],
      from: "2026-07-01",
      to: "2026-07-31",
    }),
  );
});

it("reports subcategory query failures as household load failures", async () => {
  const from = mocks.from.getMockImplementation()!;
  mocks.from.mockImplementation((table) =>
    table === "subcategories"
      ? {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: new Error("query failed") }) })),
          })),
        }
      : from(table),
  );

  await expect(dashboardDataModule.getDashboardData("2026-07")).rejects.toThrow("Unable to load household data.");
});
