import { CategorySheet } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentHouseholdContext } from "@/lib/household";
import { selectCategoryPastelColor } from "@/lib/shared-colors";

export default async function CategoriesPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;
  const categories = household.supabase
    .from("categories")
    .select("id, name, kind, color, icon, archived_at")
    .eq("household_id", household.householdId);
  categories.order("kind");
  const [categoriesResult, subcategoriesResult] = await Promise.all([
    categories.order("name"),
    household.supabase
      .from("subcategories")
      .select("id, category_id, name, color, icon, archived_at, transactions(count)")
      .eq("household_id", household.householdId)
      .order("name"),
  ]);
  const subcategoryData = (subcategoriesResult.data ?? []).map(({ transactions, ...subcategory }) => ({
    ...subcategory,
    transactionCount: transactions?.[0]?.count ?? 0,
  }));
  const categoryData = (categoriesResult.data ?? []).map((category) => ({
    ...category,
    transactionCount: subcategoryData.reduce(
      (count, subcategory) => count + (subcategory.category_id === category.id ? subcategory.transactionCount : 0),
      0,
    ),
  }));
  const defaultColor = selectCategoryPastelColor(categoryData.map((category) => category.color));
  return (
    <WorkspaceShell
      title="Categories"
      description="Keep income and expense reporting clear."
      actions={
        <CategorySheet
          categories={categoryData
            .filter((category) => !category.archived_at)
            .map((category) => ({
              ...category,
              subcategoryColors: subcategoryData.filter((subcategory) => subcategory.category_id === category.id).map((subcategory) => subcategory.color),
            }))}
          defaultColor={defaultColor}
        />
      }
    >
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList categories={categoryData} subcategories={subcategoryData} />
      </div>
    </WorkspaceShell>
  );
}
