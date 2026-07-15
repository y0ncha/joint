"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

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

export function buildLedgerMonthPath(year: string, month: string) {
  return `/transactions?month=${year}-${month}`;
}

export function getLedgerYearOptions(selectedYear: number, currentYear = new Date().getFullYear()) {
  const years = new Set<number>();

  for (let year = currentYear - 3; year <= currentYear + 1; year += 1) {
    years.add(year);
  }

  years.add(selectedYear);
  return [...years].sort((left, right) => right - left).map(String);
}

export function LedgerMonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const [selectedYear, selectedMonth] = month.split("-");
  const selectedMonthLabel = months.find(([value]) => value === selectedMonth)?.[1] ?? "Month";
  const years = getLedgerYearOptions(Number(selectedYear));

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3" aria-label="Ledger month controls">
      <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
        Month
        <Select
          value={selectedMonth}
          onValueChange={(nextMonth) => router.push(buildLedgerMonthPath(selectedYear, nextMonth))}
        >
          <SelectTrigger aria-label="Select ledger month" className="h-11 min-w-36 rounded-xl border-transparent bg-white/55">
            <span>{selectedMonthLabel}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {months.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
        Year
        <Select
          value={selectedYear}
          onValueChange={(nextYear) => router.push(buildLedgerMonthPath(nextYear, selectedMonth))}
        >
          <SelectTrigger aria-label="Select ledger year" className="h-11 min-w-28 rounded-xl border-transparent bg-white/55">
            <span>{selectedYear}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {years.map((year) => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
