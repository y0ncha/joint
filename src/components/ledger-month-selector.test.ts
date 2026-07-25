import { describe, expect, it } from "vitest";

import { getLedgerYearOptions, isCompleteLedgerRange } from "./ledger-month-selector";

describe("ledger month selector helpers", () => {
  it("requires distinct start and end dates before applying a custom range", () => {
    expect(isCompleteLedgerRange({ from: new Date("2026-06-10T00:00:00"), to: new Date("2026-06-10T00:00:00") })).toBe(false);
    expect(isCompleteLedgerRange({ from: new Date("2026-06-10T00:00:00"), to: new Date("2026-06-15T00:00:00") })).toBe(true);
  });

  it("keeps the selected year available even outside the default window", () => {
    expect(getLedgerYearOptions(2030, 2026)).toContain("2030");
  });
});
