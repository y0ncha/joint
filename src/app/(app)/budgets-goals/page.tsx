import { BudgetsGoalsWorkspace } from "@/components/budgets-goals-workspace";
import { WorkspacePage } from "@/components/workspace-shell";
import { getBudgetsGoalsData } from "@/lib/budgets-goals-data";

export default async function BudgetsGoalsPage() {
  const data = await getBudgetsGoalsData();

  return (
    <WorkspacePage title="Budgets & Goals" description="Configure monthly spending limits and savings goals.">
      <BudgetsGoalsWorkspace {...data} />
    </WorkspacePage>
  );
}
