import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const currentPathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => currentPathname.value }));

import { DashboardCardLoading, DashboardMembershipFallback, RouteMembershipFallback } from "./dashboard-loading";

it("keeps a visible card title and accessible reduced-motion-safe loading status", () => {
  const markup = renderToStaticMarkup(<DashboardCardLoading className="lg:col-span-6" title="Income" />);

  expect(markup).toContain('role="status"');
  expect(markup).toContain('data-slot="card-header"');
  expect(markup).toContain('data-slot="card-action"');
  expect(markup).toContain(">Income<");
  expect(markup).toContain("Loading Income");
  expect(markup).toContain("motion-safe:animate-spin");
  expect(markup).toContain("motion-reduce:animate-none");
  expect(markup).toContain("lg:col-span-6");
});

it("keeps dashboard fallback bodies proportionate to the updated card grid", () => {
  const markup = renderToStaticMarkup(<DashboardMembershipFallback />);

  expect(markup).toContain("h-16");
  expect(markup).toContain("min-h-64");
  expect(markup).toContain("h-64");
});

it("shows route-shaped membership fallbacks", () => {
  currentPathname.value = "/";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).toContain("Loading Six-month trend");
  const dashboardMarkup = renderToStaticMarkup(<DashboardMembershipFallback />);
  expect(dashboardMarkup).toContain("Loading Income");
  expect(dashboardMarkup).toContain("Loading Outgoings");
  expect(dashboardMarkup).toContain("Loading Monthly balance");
  expect(dashboardMarkup).toContain("Loading Budgets");
  expect(dashboardMarkup).toContain("Loading Gas trend");
  expect(dashboardMarkup).toContain("Loading Six-month trend");
  expect(dashboardMarkup).toContain("lg:col-span-5 md:aspect-square");
  expect(dashboardMarkup).toContain("lg:col-span-7");
  expect(dashboardMarkup).toContain("lg:col-span-12");
  expect([...dashboardMarkup.matchAll(/lg:col-span-4/g)]).toHaveLength(3);
  expect(dashboardMarkup).not.toContain("Latest activity");
  expect(dashboardMarkup).not.toContain("[contain:size]");

  currentPathname.value = "/analytics";
  const billsMarkup = renderToStaticMarkup(<RouteMembershipFallback />);
  expect(billsMarkup).toContain("Analytics");
  expect(billsMarkup).toContain("Loading Analytics…");
  expect(billsMarkup.match(/data-slot=\"card\"/g)).toHaveLength(4);

  currentPathname.value = "/analytics/bills";
  const detailMarkup = renderToStaticMarkup(<RouteMembershipFallback />);
  expect(detailMarkup).toContain("Loading chart…");
  expect(detailMarkup.match(/data-slot=\"card\"/g)).toHaveLength(1);

  currentPathname.value = "/transactions";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).not.toContain("Loading Six-month trend");
});
