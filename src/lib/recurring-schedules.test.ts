import { expect, it } from "vitest";

import { dueOccurrenceDates } from "./recurring-schedules";

it("lists weekly occurrences after the initial transaction through today", () => {
  expect(dueOccurrenceDates("2026-07-14", { every: 1, unit: "week" }, "2026-07-28")).toEqual(["2026-07-21", "2026-07-28"]);
});

it("clips monthly occurrences to the last day of shorter months", () => {
  expect(dueOccurrenceDates("2026-01-31", { every: 1, unit: "month" }, "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
});

it("honors custom intervals in weeks and months", () => {
  expect(dueOccurrenceDates("2026-07-14", { every: 2, unit: "week" }, "2026-08-25")).toEqual(["2026-07-28", "2026-08-11", "2026-08-25"]);
  expect(dueOccurrenceDates("2026-01-15", { every: 3, unit: "month" }, "2026-10-15")).toEqual(["2026-04-15", "2026-07-15", "2026-10-15"]);
});
