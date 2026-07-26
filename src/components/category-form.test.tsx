import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { categoryPastelColors } from "@/lib/shared-colors";
const categoryFormModule = await import("./category-form").catch(() => null);
it("starts with the category creation mode", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryCreationPreview />) : "";
  expect(markup).toContain('data-slot="select-trigger"');
  expect(markup).toContain('id="create-mode"');
  expect(markup).toContain("Name");
  expect(markup).toContain("Type");
  expect(markup).toContain('aria-label="Type"');
  expect(markup).toContain('type="hidden" name="kind" value="expense"');
  expect(markup).toContain("border-negative/20 bg-negative/10 text-negative");
  expect(markup).toContain("Color");
  expect(markup).toContain('name="color"');
  expect(markup).toContain('name="icon" value="tag"');
  expect(markup).toContain('aria-label="Choose icon"');
  expect(markup).toContain("Add");
  expect(markup).not.toContain("First subcategory");
});

it("labels the category creation trigger", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategorySheet />) : "";

  expect(markup).toContain('aria-label="Add category"');
});

it("offers every category pastel in the category picker", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryColorPicker />) : "";

  expect(categoryPastelColors).toHaveLength(6);
  for (const color of categoryPastelColors) expect(markup).toContain(color);
});

it("uses its provided category pastel as the default", () => {
  const markup = categoryFormModule
    ? renderToStaticMarkup(<categoryFormModule.CategoryCreationPreview defaultColor={categoryPastelColors.at(-1)} />)
    : "";

  expect(markup).toContain(`name="color" value="${categoryPastelColors.at(-1)}"`);
});

it("does not require a subcategory to create a category", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryCreationPreview />) : "";

  expect(markup).toContain('name="name"');
  expect(markup).not.toContain('name="subcategoryName"');
});

it("starts the subcategory type selector empty", () => {
  const markup = categoryFormModule ? renderToStaticMarkup(<categoryFormModule.CategoryCreationPreview initialMode="subcategory" />) : "";

  expect(markup).toContain('aria-label="Type"');
  expect(markup).toContain("Choose a value");
  expect(markup).not.toContain("All types");
});

it("preselects a category in the locked subcategory creation form", () => {
  const markup = categoryFormModule
    ? renderToStaticMarkup(
        <categoryFormModule.CategoryCreationPreview
          categories={[{ id: "food", name: "Food", kind: "expense", color: "#ccebef", icon: "utensils" }]}
          initialCategoryId="food"
          initialMode="subcategory"
          modeLocked
        />,
      )
    : "";

  expect(markup).not.toContain('id="create-mode"');
  expect(markup).toContain("Food");
  expect(markup).toContain('aria-label="Type"');
  expect(markup).toContain("Expense");
  expect(markup).toContain('name="icon" value=""');
  expect(markup).toContain("lucide-utensils");
  expect(markup).toContain("Add subcategory");
});

it("infers the type from an initially selected subcategory parent", () => {
  const markup = categoryFormModule
    ? renderToStaticMarkup(
        <categoryFormModule.CategoryCreationPreview
          categories={[
            { id: "salary", name: "Salary", kind: "income", color: "#ccebef" },
            { id: "food", name: "Food", kind: "expense", color: "#ffcff0" },
          ]}
          initialCategoryId="salary"
          initialMode="subcategory"
        />,
      )
    : "";

  expect(markup).toContain("Income");
});
