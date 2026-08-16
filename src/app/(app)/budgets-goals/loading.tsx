import { WorkspacePage } from "@/components/workspace-shell";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const sections = ["Budgets", "Goals"];

export default function BudgetsGoalsLoading() {
  return (
    <WorkspacePage title="Budgets & Goals" description="Configure monthly spending limits and savings goals.">
      <div role="status" aria-live="polite" className="sr-only">
        Loading Budgets &amp; Goals…
      </div>
      <section aria-label="Budgets and goals" className="mt-6 flex flex-col gap-4">
        {sections.map((title) => (
          <Card key={title} className="min-h-52 border-white/50 bg-card/90 [--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardAction>
                <Spinner aria-hidden="true" className="text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    </WorkspacePage>
  );
}
