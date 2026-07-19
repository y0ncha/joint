import { CategorySheet } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentHouseholdContext } from "@/lib/household";

export default async function CategoriesPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;
  const categories = household.supabase
    .from("categories")
    .select("id, name, kind, archived_at")
    .eq("household_id", household.householdId);
  categories.order("kind");
  const { data } = await categories.order("name");
  return (
    <WorkspaceShell title="Categories" description="Keep income and expense reporting clear." actions={<CategorySheet />}>
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList categories={data ?? []} />
      </div>
    </WorkspaceShell>
  );
}
