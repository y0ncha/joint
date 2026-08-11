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

it("shows route-shaped membership fallbacks", () => {
  currentPathname.value = "/";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).toContain("Loading Latest activity");

  currentPathname.value = "/bills-groceries";
  const billsMarkup = renderToStaticMarkup(<RouteMembershipFallback />);
  expect(billsMarkup).toContain("Bills &amp; Groceries");
  expect(billsMarkup).toContain("Loading Bills &amp; Groceries…");
  expect(billsMarkup.match(/data-slot=\"card\"/g)).toHaveLength(4);

  currentPathname.value = "/bills-groceries/bills";
  const detailMarkup = renderToStaticMarkup(<RouteMembershipFallback />);
  expect(detailMarkup).toContain("Loading chart…");
  expect(detailMarkup.match(/data-slot=\"card\"/g)).toHaveLength(1);

  currentPathname.value = "/transactions";
  expect(renderToStaticMarkup(<RouteMembershipFallback />)).not.toContain("Loading Latest activity");
});
