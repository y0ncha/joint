import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { DashboardCardLoading } from "./dashboard-loading";

it("keeps a visible card title and accessible reduced-motion-safe loading status", () => {
  const markup = renderToStaticMarkup(<DashboardCardLoading className="lg:col-span-6" title="Income" />);

  expect(markup).toContain('role="status"');
  expect(markup).toContain(">Income<");
  expect(markup).toContain("Loading Income");
  expect(markup).toContain("motion-safe:animate-spin");
  expect(markup).toContain("motion-reduce:animate-none");
  expect(markup).toContain("lg:col-span-6");
});
