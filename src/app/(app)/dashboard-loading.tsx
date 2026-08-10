import { LoaderCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCardLoading({ className, title }: { className?: string; title: string }) {
  return (
    <Card className={cn("border-white/50 bg-card/90", className)}>
      <CardContent className="p-5 sm:p-6">
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <LoaderCircle aria-hidden="true" className="size-4 text-muted-foreground motion-safe:animate-spin motion-reduce:animate-none" />
          <span className="sr-only">Loading {title}</span>
        </div>
        <div className="mt-5 h-8 rounded bg-muted motion-safe:animate-pulse motion-reduce:animate-none" />
      </CardContent>
    </Card>
  );
}
