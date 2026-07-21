import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses one edit button without showing or revealing card digits", () => {
  const source = readFileSync("src/components/member-card-settings-control.tsx", "utf8");

  expect(source).toContain("Card last four");
  expect(source).toContain("MemberCardForm");
  expect(source).toContain('redirectTo="/settings"');
  expect(source).toContain("Edit");
  expect(source).not.toContain("Eye");
  expect(source).not.toContain("useState");
  expect(source).not.toContain("PopoverDescription");
  expect(source).toContain('variant="outline"');
  expect(source).toContain("min-h-11 border-transparent bg-white/55");
  expect(source).not.toContain("CreditCard");
  expect(source).not.toMatch(/lastFour \?[^?]/);
});
