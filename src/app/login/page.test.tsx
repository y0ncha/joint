import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

describe("Joint sign in", () => {
  it("offers Google sign in for the shared household", async () => {
    const markup = renderToStaticMarkup(await LoginPage());

    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("shared household");
    expect(markup).toContain('alt="Joint logo"');
    expect(markup).toContain('width="72" height="72"');
    expect(markup).toContain("justify-center");
    expect(markup).toContain("sm:pt-12");
    expect(markup).toContain("sm:pb-12");
    expect(markup).toContain("mt-12");
    expect(markup).toContain("hover:translate-y-0");
    expect(markup).not.toContain("flaticon.com");
    expect(markup).not.toContain('data-slot="tooltip-trigger"');
  });
});
