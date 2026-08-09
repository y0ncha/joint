import { isCanonicalIsoDate } from "./date-range";

export type Recurrence = { every: number; unit: "week" | "month" };

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function occurrenceAt(anchor: string, recurrence: Recurrence, position: number) {
  const start = dateFromIso(anchor);
  if (recurrence.unit === "week") {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + recurrence.every * 7 * position);
    return isoFromDate(date);
  }

  const targetMonth = start.getUTCMonth() + recurrence.every * position;
  const year = start.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(start.getUTCDate(), daysInMonth(year, month))).padStart(2, "0")}`;
}

export function dueOccurrenceDates(anchor: string, recurrence: Recurrence, through: string) {
  if (!isCanonicalIsoDate(anchor) || !isCanonicalIsoDate(through) || recurrence.every < 1 || !Number.isInteger(recurrence.every)) return [];
  const dates: string[] = [];
  for (let position = 1; ; position += 1) {
    const date = occurrenceAt(anchor, recurrence, position);
    if (date > through) return dates;
    dates.push(date);
  }
}
