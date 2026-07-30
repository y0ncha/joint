import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import BillsPage from "./bills/page";
import DailyPage from "./daily/page";
import GroceriesPage from "./groceries/page";
import YearOverYearPage from "./year-over-year/page";

vi.mock("@/components/essentials-dashboard", () => ({
  EssentialsChartDetail: ({ chart }: { chart: string }) => <output>{chart}</output>,
}));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ title, opaqueContent, children }: { title?: string; opaqueContent?: boolean; children: React.ReactNode }) => (
    <main>
      {title ? <h1>{title}</h1> : null}
      <output>{String(opaqueContent)}</output>
      {children}
    </main>
  ),
}));

it.each([
  [BillsPage, "bills"],
  [YearOverYearPage, "yoy"],
  [GroceriesPage, "groceries"],
  [DailyPage, "daily"],
])("renders %s as a header-free chart detail page", (Page, chart) => {
  const markup = renderToStaticMarkup(<Page />);

  expect(markup).not.toContain("<h1>");
  expect(markup).toContain("<output>true</output>");
  expect(markup).toContain(`<output>${chart}</output>`);
});
