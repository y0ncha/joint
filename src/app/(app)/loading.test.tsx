import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

import { DashboardCardLoading } from "./dashboard-loading";

describe("dashboard loading state", () => {
  it("keeps each dashboard card in place while its data is loading", () => {
    const markup = renderToStaticMarkup(<DashboardCardLoading title="Income" />);

    expect(markup).toContain("Income");
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Loading Income");
  });
});
