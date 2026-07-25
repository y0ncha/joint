"use client";

import { Settings2 } from "lucide-react";

import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { DateRange } from "@/lib/date-range";

export function DashboardControls({ month, range }: { month: string; range?: DateRange }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Dashboard controls">
          <Settings2 aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="border-border bg-card/95 p-0 shadow-lg md:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Dashboard controls</SheetTitle>
          <SheetDescription>Choose the reporting period.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <LedgerMonthSelector month={month} range={range} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
