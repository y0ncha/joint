import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("shows an accessible chart-detail placeholder before chart data resolves", async () => {
  const { default: BillsGroceriesDetailLoading } = await import("./loading");
  const markup = renderToStaticMarkup(<BillsGroceriesDetailLoading />);

  expect(markup).toContain("Loading Bills &amp; Groceries…");
  expect(markup).toContain("Loading chart…");
  expect(markup.match(/data-slot=\"card\"/g)).toHaveLength(1);
});
