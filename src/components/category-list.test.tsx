import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
const categoryListModule = await import("./category-list").catch(() => null);
it("shows a truthful category empty state", () => {
  const markup = categoryListModule ? renderToStaticMarkup(<categoryListModule.CategoryList categories={[]} />) : "";
  expect(markup).toContain("No categories yet");
});

it("shows category kind as a badge status", () => {
  const source = readFileSync("src/components/category-list.tsx", "utf8");
  const markup = categoryListModule ? renderToStaticMarkup(
    <categoryListModule.CategoryList categories={[
      { id: "income-id", name: "Salary", kind: "income", archived_at: null },
      { id: "expense-id", name: "Food", kind: "expense", archived_at: null },
    ]} />,
  ) : "";

  expect(markup).toContain("Salary");
  expect(markup).toContain("Income");
  expect(markup).toContain("Food");
  expect(markup).toContain("Expense");
  expect((markup.match(/data-slot="badge"/g) ?? []).length).toBe(2);
  expect(markup).toContain("divide-y divide-border/70");
  expect(markup).not.toContain("rounded-lg border border-border bg-background/35");
  expect(source).toContain("DialogTrigger asChild");
  expect(source).toContain("DialogContent");
  expect(source).not.toContain("<details>");
  expect(source).not.toContain("<summary");
  expect(source).toContain("Delete category");
  expect(source).toContain("variant=\"destructive\"");
  expect(source).toContain("ArrowDownRight");
  expect(source).toContain("ArrowUpRight");
  expect(source).toContain("data-icon=\"inline-start\"");
});
