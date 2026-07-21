import { StatementImportForm } from "@/components/statement-import-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentHouseholdContext } from "@/lib/household";

export default async function StatementImportPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;

  return (
    <WorkspaceShell title="Import statement" description="Add a supported card statement to the shared ledger.">
      <div className="mt-6 flex w-full flex-col gap-5">
        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Upload a statement</CardTitle>
            <CardDescription>Valid rows are saved immediately to the shared household ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatementImportForm />
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
