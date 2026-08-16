"use client";

import { WorkspacePage } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const loadingCards = [
  ["Bills by month", "xl:col-span-5"],
  ["Year-over-year", "xl:col-span-5"],
  ["Groceries by month", "xl:col-span-3"],
  ["Groceries by day", "xl:col-span-2"],
] as const;

export function AnalyticsLoading() {
  return (
    <WorkspacePage title="Analytics" description="Bills, groceries, and fuel without losing the daily detail.">
      <div role="status" aria-live="polite" className="sr-only">
        Loading Analytics…
      </div>
      <section aria-label="Analytics charts" className="mt-6 grid gap-4 xl:grid-cols-5">
        {loadingCards.map(([title, layoutClassName]) => (
          <Card key={title} className={`min-w-0 border-border bg-card/80 px-3 py-7 ${layoutClassName}`}>
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

export function AnalyticsDetailLoading() {
  return (
    <WorkspacePage opaqueContent>
      <div role="status" aria-live="polite" className="sr-only">
        Loading Analytics…
      </div>
      <section aria-label="Analytics chart" className="mt-0">
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
    </WorkspacePage>
  );
}
