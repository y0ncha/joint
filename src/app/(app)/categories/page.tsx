import { CategorySheet } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CategoriesPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { data } = await (await createServerSupabaseClient()).from("categories").select("id, name, kind, archived_at").eq("household_id", household.householdId).order("kind").order("name");
  return (
    <WorkspaceShell title="Categories" description="Keep income and expense reporting clear." actions={<CategorySheet />}>
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList categories={data ?? []} />
      </div>
    </WorkspaceShell>
  );
}
