import { CategoriesWorkspace } from "@/components/categories-workspace";
import { getCurrentHouseholdContext } from "@/lib/household";
import { selectCategoryPastelColor } from "@/lib/shared-colors";

export default async function CategoriesPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;
  const categories = household.supabase
    .from("categories")
    .select("id, name, kind, color, icon, archived_at, system_key")
    .eq("household_id", household.householdId);
  categories.order("kind");
  const [categoriesResult, subcategoriesResult] = await Promise.all([
    categories.order("name"),
    household.supabase
      .from("subcategories")
      .select("id, category_id, name, color, icon, archived_at, system_key, transactions(count)")
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
  return <CategoriesWorkspace categories={categoryData} subcategories={subcategoryData} defaultColor={defaultColor} />;
}
