import { CategoryForm } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CategoriesPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { data } = await (await createServerSupabaseClient()).from("categories").select("id, name, kind, archived_at").eq("household_id", household.householdId).order("kind").order("name");
  return (
    <WorkspaceShell title="Categories" description="Keep income and expense reporting clear.">
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryList categories={data ?? []} />
        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Add category</CardTitle>
            <CardDescription>Create the categories used in monthly reporting.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm />
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
