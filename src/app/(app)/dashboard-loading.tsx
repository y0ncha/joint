"use client";

import { usePathname } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { WorkspacePage } from "@/components/workspace-shell";
import { cn } from "@/lib/utils";

export function DashboardActionsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <Skeleton aria-hidden="true" className="size-11 rounded-full" />
      <Skeleton aria-hidden="true" className="size-11 rounded-full" />
      <span className="sr-only">Loading dashboard controls</span>
    </div>
  );
}

export function DashboardCardLoading({ className, title }: { className?: string; title: string }) {
  return (
    <Card className={cn("border-white/50 bg-card/90", className)}>
      <CardContent className="p-5 sm:p-6">
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Spinner aria-hidden="true" className="text-muted-foreground" />
          <span className="sr-only">Loading {title}</span>
        </div>
        <Skeleton className="mt-5 h-8" />
      </CardContent>
    </Card>
  );
}

export function DashboardMembershipFallback() {
  return (
    <WorkspacePage title="Shared money" description="A calm view of your household money." actions={<DashboardActionsLoading />}>
      <section className="mt-6 grid gap-4 lg:grid-cols-12">
        <DashboardCardLoading className="lg:col-span-6" title="Income" />
        <DashboardCardLoading className="lg:col-span-6" title="Outgoings" />
        <DashboardCardLoading className="lg:col-span-8" title="Where your money went" />
        <DashboardCardLoading className="lg:col-span-4" title="Monthly balance" />
      </section>
      <DashboardCardLoading className="mt-4" title="Latest activity" />
    </WorkspacePage>
  );
}

export function RouteMembershipFallback() {
  return usePathname() === "/" ? <DashboardMembershipFallback /> : null;
}
