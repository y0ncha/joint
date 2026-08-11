export type DateRange = { from: string; to: string };

const DAY_MS = 86_400_000;
const rangeDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const shortRangeDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

export function isCanonicalIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isCanonicalIsoMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isoDateToEpochDay(value: string) {
  if (!isCanonicalIsoDate(value)) throw new Error(`Invalid ISO date: ${value}`);
  return Date.parse(`${value}T00:00:00Z`) / DAY_MS;
}

export function epochDayToIsoDate(value: number) {
  if (!Number.isInteger(value)) throw new Error(`Invalid UTC epoch day: ${value}`);
  const date = new Date(value * DAY_MS);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid UTC epoch day: ${value}`);
  const isoDate = date.toISOString().slice(0, 10);
  if (!isCanonicalIsoDate(isoDate)) throw new Error(`Invalid UTC epoch day: ${value}`);
  return isoDate;
}

export function shiftIsoDate(value: string, days: number) {
  return epochDayToIsoDate(isoDateToEpochDay(value) + days);
}

export function inclusiveIsoDayCount(from: string, to: string) {
  return isoDateToEpochDay(to) - isoDateToEpochDay(from) + 1;
}

export function previousThreeDateRanges(range: DateRange): [DateRange, DateRange, DateRange] {
  const days = inclusiveIsoDayCount(range.from, range.to);
  return [1, 2, 3].map((offset) => ({
    from: shiftIsoDate(range.from, -days * offset),
    to: shiftIsoDate(range.to, -days * offset),
  })) as [DateRange, DateRange, DateRange];
}

export function shiftIsoMonth(value: string, months: number) {
  if (!isCanonicalIsoMonth(value) || !Number.isInteger(months)) throw new Error(`Invalid ISO month: ${value}`);
  const monthIndex = Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1 + months;
  const year = Math.floor(monthIndex / 12);
  if (year < 0 || year > 9999) throw new Error(`Invalid ISO month: ${value}`);
  return `${String(year).padStart(4, "0")}-${String((monthIndex % 12) + 1).padStart(2, "0")}`;
}

export function getIsoMonthRange(value: string): DateRange | undefined {
  if (!isCanonicalIsoMonth(value)) return undefined;
  const monthEnd = new Date(`${value}-01T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  return { from: `${value}-01`, to: monthEnd.toISOString().slice(0, 10) };
}

export function getValidDateRange(from: string | undefined, to: string | undefined): DateRange | undefined {
  if (!from || !to || !isCanonicalIsoDate(from) || !isCanonicalIsoDate(to) || from > to) return undefined;
  return { from, to };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function previousMonth() {
  return shiftIsoMonth(currentMonth(), -1);
}

export function formatDateRange(range: DateRange) {
  return `${rangeDate.format(new Date(`${range.from}T00:00:00Z`))} – ${rangeDate.format(new Date(`${range.to}T00:00:00Z`))}`;
}

export function formatShortDateRange(range: DateRange) {
  return `${shortRangeDate.format(new Date(`${range.from}T00:00:00Z`))} – ${shortRangeDate.format(new Date(`${range.to}T00:00:00Z`))}`;
}
