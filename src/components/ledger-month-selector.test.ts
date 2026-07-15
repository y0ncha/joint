import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildLedgerMonthPath, getLedgerYearOptions } from "./ledger-month-selector";

describe("ledger month selector helpers", () => {
  it("builds the transactions path for an immediately selected month", () => {
    expect(buildLedgerMonthPath("2026", "06")).toBe("/transactions?month=2026-06");
  });

  it("keeps the selected year available even outside the default window", () => {
    expect(getLedgerYearOptions(2030, 2026)).toContain("2030");
  });

  it("uses SelectValue so each menu stays anchored to its trigger", () => {
    const source = readFileSync("src/components/ledger-month-selector.tsx", "utf8");

    expect(source).toContain("SelectValue");
    expect(source).toContain("<SelectValue />");
    expect(source).not.toContain("<span>{selectedMonthLabel}</span>");
    expect(source).not.toContain("<span>{selectedYear}</span>");
  });
});
