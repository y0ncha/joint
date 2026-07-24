import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

describe("Joint sign in", () => {
  it("offers Google sign in for the shared household", async () => {
    const markup = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("shared household");
    expect(markup).toContain('alt="Joint logo"');
  });

  it("explains when the signed-in Google account has no household access", async () => {
    const markup = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ error: "access_denied" }),
    }));

    expect(markup).toContain("This Google account does not have access to Joint.");
    expect(markup).toContain('role="alert"');
  });

  it.each(["missing_code", "oauth_callback"])("explains when Google sign-in cannot complete (%s)", async (error) => {
    const markup = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ error }) }));

    expect(markup).toContain("We couldn&#x27;t sign you in with Google. Please try again.");
    expect(markup).toContain('role="alert"');
  });
});
