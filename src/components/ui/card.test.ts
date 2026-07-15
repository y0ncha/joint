import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses a subtle hover treatment without card lift", () => {
  const source = readFileSync("src/components/ui/card.tsx", "utf8");

  expect(source).not.toContain("hover:-translate");
  expect(source).not.toContain("transition-[transform");
  expect(source).toContain("transition-shadow");
  expect(source).toContain("hover:shadow-[0_18px_42px_-16px]");
  expect(source).toContain("hover:shadow-foreground/20");
});
