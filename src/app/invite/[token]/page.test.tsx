import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  getCurrentHousehold: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const pageModule = await import("./page").catch(() => null);

describe("invite route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims } });
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    mocks.getCurrentHousehold.mockResolvedValue(null);
  });

  it("sends an anonymous invitee through login with the invitation preserved", async () => {
    await pageModule?.default({ params: Promise.resolve({ token: "invite-token" }) });

    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Fonboarding%3Ftoken%3Dinvite-token");
  });
});
