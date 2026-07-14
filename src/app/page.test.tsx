import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentHousehold: vi.fn() }));

vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));

import Home from "./page";

describe("Joint dashboard", () => {
  beforeEach(() => {
    mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });
  });

  it("shows the shared balance and the primary transaction action for a household member", async () => {
    const markup = renderToStaticMarkup(await Home());

    expect(markup).toContain("Shared balance");
    expect(markup).toContain("Add transaction");
    expect(markup).toContain("This month");
    expect(markup).toContain('alt="Joint logo"');
    expect(markup).not.toContain("flaticon.com");
    expect(markup).not.toContain('data-slot="tooltip-trigger"');
  });
});
