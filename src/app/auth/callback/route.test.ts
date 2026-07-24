import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
  ensurePartnerMembership: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/household", () => ({
  ensurePartnerMembership: mocks.ensurePartnerMembership,
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        getClaims: mocks.getClaims,
        signOut: mocks.signOut,
      },
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "partner-id",
          email: " Partner@Example.com ",
          app_metadata: { provider: "google" },
        },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.ensurePartnerMembership.mockResolvedValue("joined");
  });

  it("joins an authorized partner using normalized verified claims", async () => {
    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code");
    expect(mocks.ensurePartnerMembership).toHaveBeenCalledWith(expect.anything(), {
      userId: "partner-id",
      email: "partner@example.com",
    });
    expect(response.headers.get("location")).toBe("https://joint.test/setup/card");
  });

  it("sends existing members to their household", async () => {
    mocks.ensurePartnerMembership.mockResolvedValue("existing");

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(response.headers.get("location")).toBe("https://joint.test/setup/card");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("clears an unmatched local session and denies access", async () => {
    mocks.ensurePartnerMembership.mockResolvedValue("unmatched");

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://joint.test/login?error=access_denied");
  });

  it("denies a callback without a verified subject and email", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "partner-id", app_metadata: { provider: "google" } } },
      error: null,
    });

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.ensurePartnerMembership).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://joint.test/login?error=access_denied");
  });

  it("denies verified claims from a non-Google provider", async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "partner-id",
          email: "partner@example.com",
          app_metadata: { provider: "email" },
        },
      },
      error: null,
    });

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.ensurePartnerMembership).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://joint.test/login?error=access_denied");
  });

  it("denies verified claims without provider metadata", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "partner-id", email: "partner@example.com" } },
      error: null,
    });

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(mocks.ensurePartnerMembership).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe("https://joint.test/login?error=access_denied");
  });

  it("rejects a callback without an OAuth code", async () => {
    const response = await GET(new Request("https://joint.test/auth/callback"));

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://joint.test/login?error=missing_code");
  });

  it("rejects a failed OAuth code exchange", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("exchange failed") });

    const response = await GET(new Request("https://joint.test/auth/callback?code=code"));

    expect(response.headers.get("location")).toBe("https://joint.test/login?error=oauth_callback");
  });
});
