import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const categoryFormModule = await import("./category-form").catch(() => null);
it("offers an accessible expense category form", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryForm />) : "";
  const source = readFileSync("src/components/category-form.tsx", "utf8");
  expect(markup).toContain("Category name");
  expect(markup).toContain("Category type");
  expect(source).toContain("transition-[background-color,border-color,color,box-shadow]");
  expect(source).toContain("duration-300");
  expect(source).toContain("motion-reduce:transition-none");
  expect(source).toContain("data-[state=on]:bg-primary");
  expect(source).toContain("data-[state=on]:text-primary-foreground");
  expect(markup).toContain("Add category");
});
