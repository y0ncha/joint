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

it("opens category creation from a right-side sheet trigger", () => {
  const source = readFileSync("src/components/category-form.tsx", "utf8");
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategorySheet />) : "";

  expect(markup).toContain("aria-label=\"Add category\"");
  expect(markup).toContain("lucide-plus");
  expect(markup).toContain("data-variant=\"ghost\"");
  expect(markup).toContain("size-9");
  expect(markup).not.toContain(">Add</span>");
  expect(source).toContain("SheetTrigger asChild");
  expect(source).toContain("SheetContent side=\"right\"");
  expect(source).toContain("h-dvh w-full max-w-none");
  expect(source).toContain("md:w-3/4 md:max-w-lg");
  expect(source).not.toContain("sm:w-3/4 sm:max-w-lg");
});
