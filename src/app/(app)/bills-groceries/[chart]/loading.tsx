import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export default function BillsGroceriesDetailLoading() {
  return (
    <WorkspaceShell opaqueContent>
      <div role="status" aria-live="polite" className="sr-only">
        Loading Bills & Groceries…
      </div>
      <section aria-label="Bills & Groceries chart" className="mt-0">
        <Card className="min-w-0 border-border bg-card/80 px-3 py-7">
          <CardHeader className="grid-cols-[1fr_auto]">
            <CardTitle>Loading chart…</CardTitle>
            <Spinner aria-hidden="true" className="text-muted-foreground" />
          </CardHeader>
          <CardContent className="mt-6">
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </section>
    </WorkspaceShell>
  );
}
