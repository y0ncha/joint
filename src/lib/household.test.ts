import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

const householdModule = await import("./household");

describe("requireCurrentHousehold", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims }, from: mocks.from });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } });
    mocks.maybeSingle.mockResolvedValue({ data: { household_id: "household-id", role: "member" }, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("returns verified user and membership identifiers", async () => {
    await expect(householdModule.requireCurrentHousehold()).resolves.toEqual({
      userId: "member-id",
      householdId: "household-id",
      role: "member",
    });
  });
});
