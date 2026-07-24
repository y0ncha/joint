"use client";

import { Settings2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type LedgerFilterKind = "all" | "income" | "expense";
export type LedgerSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export function LedgerControls({ filterKind, importRequested, month, sort }: { filterKind: LedgerFilterKind; importRequested: boolean; month: string; sort: LedgerSort }) {
  const pathname = usePathname();
  const router = useRouter();

  function update(next: Partial<{ filterKind: LedgerFilterKind; sort: LedgerSort }>) {
    const params = new URLSearchParams();
    const nextFilterKind = next.filterKind ?? filterKind;
    const nextSort = next.sort ?? sort;
    params.set("month", month);
    if (importRequested) params.set("import", "1");
    if (nextFilterKind !== "all") params.set("filter", nextFilterKind);
    if (nextSort !== "date-desc") params.set("sort", nextSort);
    router.push(params.size ? `${pathname}?${params}` : pathname);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Ledger controls">
          <Settings2 aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Ledger controls</SheetTitle>
          <SheetDescription>Filter or sort transactions.</SheetDescription>
        </SheetHeader>
        <FieldGroup className="px-6 pb-6">
          <Field>
            <FieldLabel htmlFor="ledger-filter">Filter</FieldLabel>
            <Select value={filterKind} onValueChange={(value) => update({ filterKind: value as LedgerFilterKind })}>
              <SelectTrigger id="ledger-filter" aria-label="Filter" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="all">All transactions</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expenses</SelectItem></SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ledger-sort">Sort by</FieldLabel>
            <Select value={sort} onValueChange={(value) => update({ sort: value as LedgerSort })}>
              <SelectTrigger id="ledger-sort" aria-label="Sort by" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="date-desc">Newest first</SelectItem><SelectItem value="date-asc">Oldest first</SelectItem><SelectItem value="amount-desc">Highest amount</SelectItem><SelectItem value="amount-asc">Lowest amount</SelectItem></SelectGroup></SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </SheetContent>
    </Sheet>
  );
}
