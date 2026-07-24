import { CategorySheet } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentHouseholdContext } from "@/lib/household";
import { reusableCategoryColors } from "@/lib/shared-colors";

export default async function CategoriesPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;
  const categories = household.supabase
    .from("categories")
    .select("id, name, kind, color, archived_at, transactions(count)")
    .eq("household_id", household.householdId);
  categories.order("kind");
  const { data } = await categories.order("name");
  const categoryData = (data ?? []).map(({ transactions, ...category }) => ({
    ...category,
    transactionCount: transactions?.[0]?.count ?? 0,
  }));
  const recentColors = reusableCategoryColors(categoryData.map((category) => category.color));
  return (
    <WorkspaceShell title="Categories" description="Keep income and expense reporting clear." actions={<CategorySheet recentColors={recentColors} />}>
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList categories={categoryData} recentColors={recentColors} />
      </div>
    </WorkspaceShell>
  );
}
