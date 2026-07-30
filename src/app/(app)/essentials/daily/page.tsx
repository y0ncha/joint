import { EssentialsChartDetail } from "@/components/essentials-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function DailyPage() {
  return (
    <WorkspaceShell opaqueContent>
      <EssentialsChartDetail chart="daily" />
    </WorkspaceShell>
  );
}
