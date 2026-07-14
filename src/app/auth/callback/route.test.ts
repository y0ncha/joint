import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getCurrentHousehold: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/household", () => ({
  getCurrentHousehold: mocks.getCurrentHousehold,
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentHousehold.mockResolvedValue(null);
  });

  it("exchanges a valid OAuth code then redirects to onboarding", async () => {
    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code");
    expect(response.headers.get("location")).toBe("https://joint.test/onboarding");
  });

  it("rejects an untrusted next URL after OAuth", async () => {
    const response = await GET(
      new Request("https://joint.test/auth/callback?code=code&next=https%3A%2F%2Fevil.test"),
    );

    expect(response.headers.get("location")).toBe("https://joint.test/onboarding");
  });

  it("sends existing members to the household", async () => {
    mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "member" });

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(response.headers.get("location")).toBe("https://joint.test/");
  });
});
