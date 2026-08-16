import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("shows the Bills & Groceries workspace and four chart placeholders before dashboard data resolves", async () => {
  const { default: BillsGroceriesLoading } = await import("./loading");
  const markup = renderToStaticMarkup(<BillsGroceriesLoading />);

  expect(markup).toContain("Bills &amp; Groceries");
  expect(markup).toContain("Loading Bills &amp; Groceries…");
  expect(markup.match(/data-slot=\"card\"/g)).toHaveLength(4);
  expect(markup).toContain("motion-safe:animate-pulse");
  expect(markup).toContain("motion-reduce:animate-none");
});
