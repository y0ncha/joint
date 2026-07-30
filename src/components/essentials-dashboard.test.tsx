import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { EssentialsChartDetail, EssentialsDashboard, stackedBarRadius } from "./essentials-dashboard";
import { TooltipProvider } from "./ui/tooltip";

it("rounds only the visible top segment of a stack", () => {
  expect(stackedBarRadius([380, 0], 0)).toEqual([3, 3, 0, 0]);
  expect(stackedBarRadius([380, 60], 0)).toBe(0);
  expect(stackedBarRadius([380, 60], 1)).toEqual([3, 3, 0, 0]);
});

it("links every dashboard chart to its dedicated detail page", () => {
  const markup = renderToStaticMarkup(<EssentialsDashboard />);

  expect(markup).toContain('href="/essentials/bills"');
  expect(markup).toContain('href="/essentials/year-over-year"');
  expect(markup).toContain('href="/essentials/groceries"');
  expect(markup).toContain('href="/essentials/daily"');
});

it("renders only the requested chart and its table on a detail page", () => {
  const markup = renderToStaticMarkup(
    <TooltipProvider>
      <EssentialsChartDetail chart="daily" />
    </TooltipProvider>,
  );

  expect(markup).toContain("Daily groceries");
  expect(markup).toContain('aria-label="Daily groceries data table"');
  expect(markup).toContain('aria-label="Back to Essentials"');
  expect(markup).not.toContain(">Back to Essentials<");
  expect(markup).not.toContain("Open Daily groceries details");
  expect(markup).not.toContain("Bills by month");
  expect(markup).not.toContain("Year-over-year");
  expect(markup).not.toContain("Groceries by month");
});

it("keeps chart data tables out of the default card view", () => {
  const markup = renderToStaticMarkup(<EssentialsDashboard />);

  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Daily groceries"]) {
    expect(markup).toContain(title);
    expect(markup).not.toContain(`aria-label="${title} data table"`);
  }

  expect(markup.indexOf("Bills by month")).toBeLessThan(markup.indexOf("Year-over-year"));
  expect(markup.indexOf("Year-over-year")).toBeLessThan(markup.indexOf("Groceries by month"));
  expect(markup.indexOf("Groceries by month")).toBeLessThan(markup.indexOf("Daily groceries"));
  expect(markup).not.toContain('aria-label="Essentials controls"');
  for (const title of ["Bills by month", "Year-over-year", "Groceries by month", "Daily groceries"]) {
    expect(markup).toContain(`aria-label="Configure ${title}"`);
    expect(markup).toContain(`aria-label="Open ${title} details"`);
  }
  expect(markup).not.toContain('aria-label="Choose Bills subcategories"');
  expect(markup).not.toContain('aria-label="Select year-over-year Bill"');
  expect(markup).toContain('aria-label="Configure Daily groceries"');
  expect(markup).toContain('aria-label="Scrollable daily groceries plot"');
  expect(markup).toContain('aria-label="Stacked daily groceries chart, use arrow keys to inspect values"');
  expect(markup).not.toContain("Budget ₪2,200.00");
  expect(markup).not.toContain("fixture values");
  expect(markup).not.toContain("Daily total");
  expect(markup).toContain("use arrow keys to inspect values");
  expect(markup).not.toContain('data-slot="collapsible"');
});
