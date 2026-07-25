"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const monthFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function buildDashboardMonthPath(month: string) {
  return `/?month=${month}`;
}

export function getDashboardMonthOptions(transactionDates: string[], currentMonth: string, selectedMonth: string) {
  return [...new Set([...transactionDates.map((date) => date.slice(0, 7)), currentMonth, selectedMonth])]
    .filter((month) => monthPattern.test(month))
    .sort((left, right) => right.localeCompare(left));
}

export function formatDashboardMonth(month: string) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

export function DashboardMonthSelector({ currentMonth, month, transactionDates }: { currentMonth: string; month: string; transactionDates: string[] }) {
  const router = useRouter();
  const months = getDashboardMonthOptions(transactionDates, currentMonth, month);

  return (
    <Select value={month} onValueChange={(nextMonth) => router.push(buildDashboardMonthPath(nextMonth))}>
      <SelectTrigger aria-label="Select dashboard month" className="min-h-11 min-w-40 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {months.map((option) => (
            <SelectItem key={option} value={option}>{formatDashboardMonth(option)}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
