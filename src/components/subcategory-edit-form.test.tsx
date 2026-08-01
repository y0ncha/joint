import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import { SubcategoryEditForm } from "./subcategory-edit-form";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
}));

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

it("excludes Groceries from ordinary subcategory moves", () => {
  const markup = renderToStaticMarkup(
    <SubcategoryEditForm
      subcategory={{ id: "utilities", category_id: "bills", name: "Utilities", color: "#d9f0fa", icon: null }}
      categories={[
        { id: "bills", name: "Bills", color: "#ccebef", system_key: "bills", subcategoryColors: [] },
        { id: "groceries", name: "Renamed protected category", color: "#ffcff0", system_key: "groceries", subcategoryColors: [] },
        { id: "home", name: "Home", color: "#dcece3", subcategoryColors: [] },
      ]}
    />,
  );

  expect(markup).toContain("Bills");
  expect(markup).toContain("Home");
  expect(markup).not.toContain("Renamed protected category");
});
