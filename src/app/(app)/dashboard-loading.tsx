"use client";

import { usePathname } from "next/navigation";

import { BillsGroceriesDetailLoading, BillsGroceriesLoading } from "@/components/bills-groceries-loading";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <CardAction>
          <Spinner aria-hidden="true" className="text-muted-foreground" />
        </CardAction>
        <span role="status" aria-live="polite" className="sr-only">
          Loading {title}
        </span>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <Skeleton className="h-8" />
      </CardContent>
    </Card>
  );
}

export function DashboardMembershipFallback() {
  return (
    <WorkspacePage title="Shared money" description="A calm view of your household money." actions={<DashboardActionsLoading />}>
      <section className="mt-6 grid gap-4 lg:grid-cols-12">
        <DashboardCardLoading className="h-full lg:col-span-4" title="Income" />
        <DashboardCardLoading className="h-full lg:col-span-4" title="Outgoings" />
        <DashboardCardLoading className="h-full lg:col-span-4" title="Shared balance" />
        <DashboardCardLoading className="lg:col-span-5 lg:aspect-square" title="Where your money went" />
        <DashboardCardLoading className="h-full lg:col-span-7" title="Budgets" />
        <DashboardCardLoading className="min-h-80 lg:col-span-12" title="Six-month trend" />
      </section>
    </WorkspacePage>
  );
}

export function RouteMembershipFallback() {
  const pathname = usePathname();
  if (pathname === "/") return <DashboardMembershipFallback />;
  if (pathname === "/bills-groceries") return <BillsGroceriesLoading />;
  return pathname.startsWith("/bills-groceries/") ? <BillsGroceriesDetailLoading /> : null;
}
