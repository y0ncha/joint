import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses regular selects for ledger filtering and sorting", () => {
  const source = readFileSync("src/components/ledger-controls.tsx", "utf8");

  expect(source).toContain("SelectTrigger");
  expect(source).toContain('aria-label="Filter"');
  expect(source).toContain('aria-label="Sort by"');
  expect(source).not.toContain("PillSelect");
});
