import { AccountForm } from "@/components/account-form";
import { AccountList } from "@/components/account-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household";

export default async function AccountsPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { data } = await (await createServerSupabaseClient()).from("accounts").select("id, name, kind, opening_balance, opening_balance_date, last_four_digits, statement_close_day, archived_at").eq("household_id", household.householdId).order("created_at");
  return (
    <WorkspaceShell title="Accounts" description="Manage the shared bank account and card debt.">
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AccountList accounts={data ?? []} />
        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Add account</CardTitle>
            <CardDescription>Add the accounts you use for shared household entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountForm />
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
