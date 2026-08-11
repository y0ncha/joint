import { WorkspacePage } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const loadingCards = ["Bills by month", "Year-over-year", "Groceries by month", "Groceries by day"];

export default function BillsGroceriesLoading() {
  return (
    <WorkspacePage title="Bills & Groceries" description="Bills and groceries, without losing the daily detail.">
      <div role="status" aria-live="polite" className="sr-only">
        Loading Bills & Groceries…
      </div>
      <section aria-label="Bills & Groceries charts" className="mt-6 grid gap-4 xl:grid-cols-2">
        {loadingCards.map((title) => (
          <Card key={title} className="min-w-0 border-border bg-card/80 px-3 py-7">
            <CardHeader className="grid-cols-[1fr_auto]">
              <CardTitle>{title}</CardTitle>
              <Spinner aria-hidden="true" className="text-muted-foreground" />
            </CardHeader>
            <CardContent className="mt-6">
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    </WorkspacePage>
  );
}
