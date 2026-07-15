import { describe, expect, it } from "vitest";

const authRedirect = await import("./auth-redirect").catch(() => null);

describe("buildOAuthCallbackUrl", () => {
  it("preserves an internal onboarding invitation path", () => {
    expect(authRedirect?.buildOAuthCallbackUrl("https://joint.test", "/onboarding?token=invite-token"))
      .toBe("https://joint.test/auth/callback?next=%2Fonboarding%3Ftoken%3Dinvite-token");
  });

  it("drops an external next URL", () => {
    expect(authRedirect?.buildOAuthCallbackUrl("https://joint.test", "https://evil.test"))
      .toBe("https://joint.test/auth/callback");
  });
});
