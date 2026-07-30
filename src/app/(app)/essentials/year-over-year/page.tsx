import { EssentialsChartDetail } from "@/components/essentials-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function YearOverYearPage() {
  return (
    <WorkspaceShell opaqueContent>
      <EssentialsChartDetail chart="yoy" />
    </WorkspaceShell>
  );
}
