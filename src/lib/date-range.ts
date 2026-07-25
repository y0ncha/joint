export type DateRange = { from: string; to: string };

const rangeDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const shortRangeDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });

function isCanonicalIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getValidDateRange(from: string | undefined, to: string | undefined): DateRange | undefined {
  if (!from || !to || !isCanonicalIsoDate(from) || !isCanonicalIsoDate(to) || from > to) return undefined;
  return { from, to };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function formatDateRange(range: DateRange) {
  return `${rangeDate.format(new Date(`${range.from}T00:00:00Z`))} – ${rangeDate.format(new Date(`${range.to}T00:00:00Z`))}`;
}

export function formatShortDateRange(range: DateRange) {
  return `${shortRangeDate.format(new Date(`${range.from}T00:00:00Z`))} – ${shortRangeDate.format(new Date(`${range.to}T00:00:00Z`))}`;
}
