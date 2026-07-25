"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { formatShortDateRange, type DateRange as IsoDateRange } from "@/lib/date-range";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const months = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
] as const;

export function isCompleteLedgerRange(range: DateRange | undefined): range is DateRange & { from: Date; to: Date } {
  return Boolean(range?.from && range.to);
}

export function getLedgerYearOptions(selectedYear: number, currentYear = new Date().getFullYear()) {
  const years = new Set<number>();

  for (let year = currentYear - 3; year <= currentYear + 1; year += 1) {
    years.add(year);
  }

  years.add(selectedYear);
  return [...years].sort((left, right) => right - left).map(String);
}

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dateToIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function LedgerMonthSelector({ month, range }: { month: string; range?: IsoDateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedYear, selectedMonth] = month.split("-");
  const years = getLedgerYearOptions(Number(selectedYear));
  const selectedRange = range ? { from: dateFromIso(range.from), to: dateFromIso(range.to) } : undefined;
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(selectedRange);
  const [rangeOpen, setRangeOpen] = useState(false);

  function update(params: URLSearchParams) {
    router.push(`${pathname}?${params}`);
  }

  function selectMonth(year: string, nextMonth: string) {
    const params = new URLSearchParams(searchParams);
    params.set("month", `${year}-${nextMonth}`);
    params.delete("from");
    params.delete("to");
    update(params);
  }

  function selectRange(nextRange: DateRange | undefined) {
    setPendingRange(nextRange);
    if (!isCompleteLedgerRange(nextRange)) return;
    const params = new URLSearchParams(searchParams);
    params.delete("month");
    params.set("from", dateToIso(nextRange.from));
    params.set("to", dateToIso(nextRange.to));
    update(params);
    setRangeOpen(false);
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3" aria-label="Ledger month controls">
      <Select value={selectedMonth} onValueChange={(nextMonth) => selectMonth(selectedYear, nextMonth)}>
        <SelectTrigger
          aria-label="Select ledger month"
          className="min-h-11 min-w-36 rounded-xl font-medium shadow-[0_8px_22px_-10px] shadow-foreground/10"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {months.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={selectedYear} onValueChange={(nextYear) => selectMonth(nextYear, selectedMonth)}>
        <SelectTrigger
          aria-label="Select ledger year"
          className="min-h-11 min-w-28 rounded-xl font-medium shadow-[0_8px_22px_-10px] shadow-foreground/10"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Popover
        open={rangeOpen}
        onOpenChange={(open) => {
          setRangeOpen(open);
          if (open) setPendingRange(undefined);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 min-w-48 justify-start rounded-xl shadow-[0_8px_22px_-10px] shadow-foreground/10"
            aria-label="Choose custom date range"
          >
            <CalendarDays data-icon="inline-start" />
            {range ? formatShortDateRange(range) : "Start date – End date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto rounded-2xl border-white/70 bg-popover p-3 shadow-[0_20px_60px_rgba(15,44,55,0.18)]"
        >
          <PopoverHeader>
            <PopoverTitle>Select date range</PopoverTitle>
          </PopoverHeader>
          <Calendar mode="range" min={1} selected={pendingRange} onSelect={selectRange} numberOfMonths={1} buttonVariant="ghost" />
          {range ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete("from");
                params.delete("to");
                params.set("month", month);
                setPendingRange(undefined);
                update(params);
                setRangeOpen(false);
              }}
            >
              Clear range
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
