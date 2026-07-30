import { EssentialsChartDetail } from "@/components/essentials-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function BillsPage() {
  return (
    <WorkspaceShell opaqueContent>
      <EssentialsChartDetail chart="bills" />
    </WorkspaceShell>
  );
}
