import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const categoryListModule = await import("./category-list").catch(() => null);
it("shows a truthful category empty state", () => {
  const markup = categoryListModule ? renderToStaticMarkup(<categoryListModule.CategoryList categories={[]} />) : "";
  expect(markup).toContain("Expense categories");
  expect(markup).toContain("Income categories");
  expect(markup).toContain("No expense categories yet");
  expect(markup).toContain("No income categories yet");
});
