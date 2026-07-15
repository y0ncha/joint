import { describe, expect, it } from "vitest";

import { buildLedgerMonthPath, getLedgerYearOptions } from "./ledger-month-selector";

describe("ledger month selector helpers", () => {
  it("builds the transactions path for an immediately selected month", () => {
    expect(buildLedgerMonthPath("2026", "06")).toBe("/transactions?month=2026-06");
  });

  it("keeps the selected year available even outside the default window", () => {
    expect(getLedgerYearOptions(2030, 2026)).toContain("2030");
  });
});
