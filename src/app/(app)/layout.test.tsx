import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdContext: mocks.getCurrentHouseholdContext,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AuthenticatedAppLayout from "./layout";

describe("protected app layout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentHouseholdContext.mockResolvedValue({
      status: "member",
      householdId: "household-id",
      role: "member",
      userId: "member-id",
    });
  });

  it("renders product routes for a verified household member", async () => {
    await expect(AuthenticatedAppLayout({ children: "protected" })).resolves.toBe("protected");

    expect(mocks.getCurrentHouseholdContext).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sends unauthenticated visitors to login", async () => {
    mocks.getCurrentHouseholdContext.mockResolvedValue({ status: "unauthenticated" });

    await AuthenticatedAppLayout({ children: "protected" });

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("clears access for a verified user without membership", async () => {
    mocks.getCurrentHouseholdContext.mockResolvedValue({ status: "unmatched" });

    await AuthenticatedAppLayout({ children: "protected" });

    expect(mocks.redirect).toHaveBeenCalledWith("/auth/access-denied");
  });
});
