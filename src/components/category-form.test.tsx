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

it("uses circles with a custom popover for category colors", () => {
  const markup = categoryFormModule
    ? renderToStaticMarkup(<categoryFormModule.CategoryColorPicker recentColors={["#123456"]} />)
    : "";

  expect(markup).toContain('name="color"');
  expect(markup).toContain("Custom color");
});

it("opens category creation from a right-side sheet trigger", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategorySheet />) : "";

  expect(markup).toContain("aria-label=\"Add category\"");
  expect(markup).toContain("lucide-plus");
  expect(markup).toContain("data-variant=\"ghost\"");
  expect(markup).toContain("size-9");
  expect(markup).not.toContain(">Add</span>");
});
