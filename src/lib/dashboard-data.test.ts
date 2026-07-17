import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildMonthlyReport: vi.fn(),
  getClaims: vi.fn(),
  getCurrentHousehold: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/financial-report", () => ({ buildMonthlyReport: mocks.buildMonthlyReport }));
vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));

const dashboardDataModule = await import("./dashboard-data").catch(() => null);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } });
  mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims }, from: mocks.from });
  mocks.buildMonthlyReport.mockReturnValue({ sharedBalance: 9275.5 });
  mocks.from.mockImplementation((table) => {
    if (table === "accounts") throw new Error("Dashboard loading must not query accounts.");
    const result = table === "households"
      ? { data: { opening_balance: "9000.50" }, error: null }
      : table === "categories"
        ? { data: [{ id: "food", name: "Food", kind: "expense", archived_at: null }], error: null }
        : table === "transactions"
          ? { data: [{ id: "transaction-id", kind: "expense", amount: "125", occurred_on: "2026-07-14", category_id: "food", note: "Groceries", created_at: "2026-07-14T08:00:00Z", paid_by: "member-id" }], error: null }
          : { data: [{ user_id: "member-id", role: "owner" }], error: null };
    const query = { order: vi.fn().mockResolvedValue(result) };
    return table === "households"
      ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue(result) })) })) }
      : { select: vi.fn(() => ({ eq: vi.fn(() => query) })) };
  });
});

it("loads the household opening balance into an account-free shared-balance report", async () => {
  const data = await dashboardDataModule?.getDashboardData("2026-07");

  expect(data).toMatchObject({ report: { sharedBalance: 9275.5 } });
  expect(data).not.toHaveProperty("accounts");
  expect(data).not.toHaveProperty("setupRequired");
  expect(mocks.buildMonthlyReport).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 9000.5, month: "2026-07" }));
  expect(mocks.from).toHaveBeenCalledWith("households");
  expect(mocks.from).not.toHaveBeenCalledWith("accounts");
});
