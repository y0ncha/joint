import { EssentialsDashboard } from "@/components/essentials-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";

export default function EssentialsPage() {
  return (
    <WorkspaceShell title="Essentials" description="Bills and groceries, without losing the daily detail.">
      <EssentialsDashboard />
    </WorkspaceShell>
  );
}
