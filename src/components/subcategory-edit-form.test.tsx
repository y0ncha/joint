import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { SubcategoryEditForm } from "./subcategory-edit-form";

it("lets a subcategory select another parent in its category type", () => {
  const markup = renderToStaticMarkup(
    <SubcategoryEditForm
      subcategory={{ id: "groceries", category_id: "food", name: "Groceries", color: "#d9f0fa", icon: null }}
      categories={[
        { id: "food", name: "Food", color: "#ccebef", icon: "utensils", subcategoryColors: [] },
        { id: "home", name: "Home", color: "#ffcff0", icon: "home", subcategoryColors: [] },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="Parent category"');
  expect(markup).toContain('name="categoryId" value="food"');
  expect(markup).toContain('name="icon" value=""');
  expect(markup).toContain("lucide-utensils");
  expect(markup).toContain("Save subcategory");
  expect(markup.indexOf("Name")).toBeLessThan(markup.indexOf("Color"));
  expect(markup.indexOf("Color")).toBeLessThan(markup.indexOf("Parent category"));
});
