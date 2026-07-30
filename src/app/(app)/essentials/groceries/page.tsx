import { EssentialsChartDetail } from "@/components/essentials-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function GroceriesPage() {
  return (
    <WorkspaceShell opaqueContent>
      <EssentialsChartDetail chart="groceries" />
    </WorkspaceShell>
  );
}
