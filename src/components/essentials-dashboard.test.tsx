import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { EssentialsDashboard, stackedBarRadius } from "./essentials-dashboard";

it("rounds only the visible top segment of a stack", () => {
  expect(stackedBarRadius([380, 0], 0)).toEqual([3, 3, 0, 0]);
  expect(stackedBarRadius([380, 60], 0)).toBe(0);
  expect(stackedBarRadius([380, 60], 1)).toEqual([3, 3, 0, 0]);
});

it("gives every chart card a stable view-transition identity", () => {
  const markup = renderToStaticMarkup(<EssentialsDashboard />);

  for (const chart of ["bills", "yoy", "groceries", "daily"]) {
    expect(markup).toContain(`view-transition-name:essentials-chart-${chart}`);
  }
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
    expect(markup).toContain(`aria-label="Expand ${title}"`);
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
