import { describe, expect, it } from "vitest";

import {
  epochDayToIsoDate,
  formatDateRange,
  formatShortDateRange,
  getIsoMonthRange,
  getValidDateRange,
  inclusiveIsoDayCount,
  isCanonicalIsoDate,
  isoDateToEpochDay,
  shiftIsoDate,
  shiftIsoMonth,
} from "./date-range";

describe("UTC ISO calendar helpers", () => {
  it("accepts only real canonical ISO dates", () => {
    expect(isCanonicalIsoDate("2024-02-29")).toBe(true);
    expect(isCanonicalIsoDate("2026-02-29")).toBe(false);
    expect(isCanonicalIsoDate("2026-6-01")).toBe(false);
  });

  it("converts leap days to and from UTC epoch days", () => {
    expect(isoDateToEpochDay("1970-01-01")).toBe(0);
    expect(epochDayToIsoDate(19_782)).toBe("2024-02-29");
    expect(() => isoDateToEpochDay("2024-02-30")).toThrow();
    expect(() => epochDayToIsoDate(1.5)).toThrow();
  });

  it("shifts dates across year boundaries", () => {
    expect(shiftIsoDate("2024-12-31", 1)).toBe("2025-01-01");
    expect(() => shiftIsoDate("2024-02-30", 1)).toThrow();
  });

  it("counts both endpoints of a UTC ISO span", () => {
    expect(inclusiveIsoDayCount("2024-02-28", "2024-03-01")).toBe(3);
    expect(() => inclusiveIsoDayCount("2024-02-30", "2024-03-01")).toThrow();
  });

  it("shifts canonical ISO months and returns their month-end ranges", () => {
    expect(shiftIsoMonth("2024-12", 1)).toBe("2025-01");
    expect(shiftIsoMonth("2024-03", -1)).toBe("2024-02");
    expect(() => shiftIsoMonth("2024-13", 1)).toThrow();
    expect(getIsoMonthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(getIsoMonthRange("2026-2")).toBeUndefined();
  });
});

describe("getValidDateRange", () => {
  it("accepts canonical chronological ISO dates", () => {
    expect(getValidDateRange("2024-02-29", "2024-03-01")).toEqual({ from: "2024-02-29", to: "2024-03-01" });
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-06-20", "2026-06-10"],
    ["2026-6-10", "2026-06-20"],
  ])("rejects invalid ranges", (from, to) => {
    expect(getValidDateRange(from, to)).toBeUndefined();
  });

  it("formats a date range consistently", () => {
    expect(formatDateRange({ from: "2026-07-01", to: "2026-07-15" })).toBe("01/07/2026 – 15/07/2026");
    expect(formatShortDateRange({ from: "2026-07-01", to: "2026-07-15" })).toBe("01/07/26 – 15/07/26");
  });
});
