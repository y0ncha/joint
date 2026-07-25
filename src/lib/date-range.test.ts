import { describe, expect, it } from "vitest";

import { formatDateRange, formatShortDateRange, getValidDateRange } from "./date-range";

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
