import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import AnalyticsPage from "./page";

const mocks = vi.hoisted(() => ({
  getAnalyticsData: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/components/analytics-dashboard", () => ({
  AnalyticsDashboard: () => <output>dashboard</output>,
}));

vi.mock("@/lib/analytics-data", () => ({ getAnalyticsData: mocks.getAnalyticsData }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/components/workspace-shell", () => ({
  WorkspacePage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section id="workspace-content">
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

it("keeps route content on the shared page surface", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
  mocks.getAnalyticsData.mockResolvedValue({ bills: { subcategories: [], defaultSubcategoryId: null } });
  const markup = renderToStaticMarkup(
    await AnalyticsPage({
      searchParams: Promise.resolve({}),
    }),
  );

  expect(markup).toContain("<h1>Analytics</h1>");
  expect(markup).toContain('id="workspace-content"');
  expect(markup).not.toContain("<main");
  expect(markup).toContain("dashboard");
  expect(markup).not.toContain("true");
  expect(mocks.redirect).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("canonicalizes legacy daily range parameters to the approved month without losing valid Bill selections", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
  mocks.getAnalyticsData.mockResolvedValue({
    bills: {
      subcategories: [
        { id: "electricity", name: "Electricity" },
        { id: "water", name: "Water" },
      ],
      defaultSubcategoryId: "water",
    },
  });

  await expect(
    AnalyticsPage({
      searchParams: Promise.resolve({
        period: "calendar",
        bills: "water",
        bill: "water",
        groceryFrom: "2026-06-30",
        groceryTo: "2026-07-01",
      }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT:/analytics?period=calendar&bills=water");

  expect(mocks.getAnalyticsData).toHaveBeenCalledWith({
    currentDate: "2026-07-31",
    groceryRange: { from: "2026-06-01", to: "2026-06-30" },
    period: "calendar",
  });
  expect(mocks.redirect).toHaveBeenCalledWith("/analytics?period=calendar&bills=water");
  vi.useRealTimers();
});

it("preserves every repeated unrelated query value in a canonical redirect", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
  mocks.getAnalyticsData.mockResolvedValue({ bills: { subcategories: [], defaultSubcategoryId: null } });

  await expect(
    AnalyticsPage({
      searchParams: Promise.resolve({ period: "invalid", source: ["household", "partner"] }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT:/analytics?source=household&source=partner");

  expect(mocks.redirect).toHaveBeenLastCalledWith("/analytics?source=household&source=partner");
  vi.useRealTimers();
});
