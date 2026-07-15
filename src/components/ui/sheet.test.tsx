import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps side sheets full-screen on narrow viewports", () => {
  const source = readFileSync("src/components/ui/sheet.tsx", "utf8");

  expect(source).toContain("fixed inset-0");
  expect(source).toContain("h-dvh w-full max-w-none");
  expect(source).toContain("overscroll-contain");
  expect(source).toContain("pt-[env(safe-area-inset-top)]");
  expect(source).toContain("pb-[env(safe-area-inset-bottom)]");
  expect(source).toContain("data-[side=right]:md:w-3/4");
  expect(source).not.toContain("data-[side=right]:w-3/4");
  expect(source).not.toContain("data-[side=right]:sm:max-w-sm");
});
