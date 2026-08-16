import type { AutomationDestination } from "@/lib/merchant-automations";

type PreviewSubcategory = {
  id: string;
  name: string;
  categoryName: string;
  kind: "income" | "expense";
  color: string;
  icon: string | null;
};

type PreviewDirectCategory = {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  icon?: string | null;
};

export function automationPreviewDestinations(
  subcategories: readonly PreviewSubcategory[],
  directCategories: readonly PreviewDirectCategory[],
): AutomationDestination[] {
  return [
    ...subcategories.map((subcategory) => ({
      categoryId: null,
      subcategoryId: subcategory.id,
      label: `${subcategory.kind === "income" ? "Income" : "Expense"} → ${subcategory.categoryName} → ${subcategory.name}`,
      kind: subcategory.kind,
      color: subcategory.color,
      icon: subcategory.icon,
    })),
    ...directCategories.map((category) => ({
      categoryId: category.id,
      subcategoryId: null,
      label: `${category.kind === "income" ? "Income" : "Expense"} → ${category.name}`,
      kind: category.kind,
      color: category.color,
      icon: category.icon ?? null,
    })),
  ];
}
