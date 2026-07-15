import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = readFileSync("src/app/(app)/categories/page.tsx", "utf8");

it("keeps category creation in the page action sheet instead of a second card", () => {
  expect(source).toContain('actions={<CategorySheet />}');
  expect(source).toContain("mt-6 flex flex-col gap-4");
  expect(source).not.toContain("lg:grid-cols-2");
  expect(source).not.toContain("CardTitle>Add category");
  expect(source).not.toContain("<CategoryForm");
});
