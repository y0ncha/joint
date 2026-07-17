import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  getHouseholdForUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: mocks.getHouseholdForUser,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AuthenticatedAppLayout from "./layout";

describe("protected app layout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims } });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } }, error: null });
    mocks.getHouseholdForUser.mockResolvedValue({ householdId: "household-id", role: "member" });
  });

  it("renders product routes for a verified household member", async () => {
    await expect(AuthenticatedAppLayout({ children: "protected" })).resolves.toBe("protected");

    expect(mocks.getHouseholdForUser).toHaveBeenCalledWith(expect.anything(), "member-id");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends anonymous visitors to login", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    await AuthenticatedAppLayout({ children: "protected" });

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getHouseholdForUser).not.toHaveBeenCalled();
  });

  it("clears access for a verified user without membership", async () => {
    mocks.getHouseholdForUser.mockResolvedValue(null);

    await AuthenticatedAppLayout({ children: "protected" });

    expect(mocks.redirect).toHaveBeenCalledWith("/auth/access-denied");
  });
});
