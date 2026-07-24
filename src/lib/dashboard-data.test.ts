import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildMonthlyReport: vi.fn(),
  getCurrentHouseholdContext: vi.fn(),
  from: vi.fn(),
  householdEq: vi.fn(),
  categoriesEq: vi.fn(),
  transactionsEq: vi.fn(),
  membersEq: vi.fn(),
}));

vi.mock("@/lib/financial-report", () => ({ buildMonthlyReport: mocks.buildMonthlyReport }));
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
  mocks.from.mockImplementation((table) => {
    if (table === "accounts") throw new Error("Dashboard loading must not query accounts.");
    const result = table === "households"
      ? { data: { opening_balance: "9000.50" }, error: null }
      : table === "categories"
        ? { data: [{ id: "food", name: "Food", kind: "expense", archived_at: null }], error: null }
        : table === "transactions"
          ? { data: [{ id: "transaction-id", kind: "expense", amount: "125", occurred_on: "2026-07-14", category_id: null, note: "Statement note", merchant: "Super Pharm", source: "statement_import", created_at: "2026-07-14T08:00:00Z", paid_by: null }], error: null }
          : { data: [{ user_id: "member-id", role: "owner" }], error: null };
    const query = { order: vi.fn().mockResolvedValue(result) };
    const eq = table === "households" ? mocks.householdEq
      : table === "categories" ? mocks.categoriesEq
        : table === "transactions" ? mocks.transactionsEq
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
  expect(mocks.transactionsEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.membersEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.from).not.toHaveBeenCalledWith("accounts");
});

it("keeps imported merchant, uncategorized, and unassigned fields for report rendering", async () => {
  await dashboardDataModule.getDashboardData("2026-07");

  expect(mocks.buildMonthlyReport).toHaveBeenCalledWith(expect.objectContaining({
    transactions: [expect.objectContaining({
      categoryId: null,
      paidBy: null,
      merchant: "Super Pharm",
      source: "statement_import",
    })],
  }));
});
