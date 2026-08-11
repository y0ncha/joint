import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const currentPathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => currentPathname.value }));

import { DashboardCardLoading, RouteMembershipFallback } from "./dashboard-loading";

it("keeps a visible card title and accessible reduced-motion-safe loading status", () => {
  const markup = renderToStaticMarkup(<DashboardCardLoading className="lg:col-span-6" title="Income" />);

  expect(markup).toContain('role="status"');
  expect(markup).toContain(">Income<");
  expect(markup).toContain("Loading Income");
  expect(markup).toContain("motion-safe:animate-spin");
  expect(markup).toContain("motion-reduce:animate-none");
  expect(markup).toContain("lg:col-span-6");
});

it("shows dashboard-shaped fallbacks only at the overview route", () => {
  currentPathname.value = "/";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).toContain("Loading Latest activity");

  currentPathname.value = "/transactions";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).not.toContain("Loading Latest activity");
});
