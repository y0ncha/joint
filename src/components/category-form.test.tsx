import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const categoryFormModule = await import("./category-form").catch(() => null);
it("offers an accessible expense category form", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryForm />) : "";
  expect(markup).toContain("Category name");
  expect(markup).toContain("Category type");
  expect(markup).toContain("Color");
  expect(markup).toContain('name="color"');
  expect(markup).toContain("Add category");
});

it("labels the category creation trigger", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategorySheet />) : "";

  expect(markup).toContain("aria-label=\"Add category\"");
});
