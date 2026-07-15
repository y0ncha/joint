import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getCurrentHousehold: vi.fn(), createServerSupabaseClient: vi.fn(), getClaims: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
const dashboardDataModule = await import("./dashboard-data").catch(() => null);
beforeEach(() => { vi.resetAllMocks(); mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" }); mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } }); mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims }, from: mocks.from }); mocks.order.mockResolvedValue({ data: [], error: null }); mocks.eq.mockReturnValue({ order: mocks.order }); mocks.select.mockReturnValue({ eq: mocks.eq }); mocks.from.mockReturnValue({ select: mocks.select }); });
it("returns setup data for a household without accounts", async () => {
  await expect(dashboardDataModule?.getDashboardData("2026-07")).resolves.toMatchObject({ setupRequired: true, report: { bankBalance: 0 } });
});
