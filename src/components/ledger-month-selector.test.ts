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

  it("uses regular selects for month and year", () => {
    const source = readFileSync("src/components/ledger-month-selector.tsx", "utf8");

    expect(source).toContain("SelectTrigger");
    expect(source).toContain('aria-label="Select ledger month"');
    expect(source).toContain('aria-label="Select ledger year"');
    expect(source).not.toContain("PillSelect");
  });
});
