import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
const categoryListModule = await import("./category-list").catch(() => null);
it("shows a truthful category empty state", () => {
  const markup = categoryListModule ? renderToStaticMarkup(<categoryListModule.CategoryList categories={[]} />) : "";
  expect(markup).toContain("Expense categories");
  expect(markup).toContain("Income categories");
  expect(markup).toContain("No expense categories yet");
  expect(markup).toContain("No income categories yet");
  expect((markup.match(/data-slot="card"/g) ?? []).length).toBe(2);
});

it("shows larger category pills with muted transaction counts", () => {
  const source = readFileSync("src/components/category-list.tsx", "utf8");
  const markup = categoryListModule ? renderToStaticMarkup(
    <categoryListModule.CategoryList categories={[
      { id: "income-id", name: "Salary", kind: "income", color: "#dcece3", transactionCount: 1, archived_at: null },
      { id: "expense-id", name: "Food", kind: "expense", color: "#f6e3dc", transactionCount: 3, archived_at: null },
    ]} />,
  ) : "";

  expect(markup).toContain("Salary");
  expect(markup).toMatch(/Income categories[\s\S]*Salary/);
  expect(markup).toContain('style="background-color:#dcece3;border-color:color-mix(in srgb, #dcece3, black 20%);color:color-mix(in srgb, #dcece3, black 60%)"');
  expect(markup).toContain("Food");
  expect(markup).toContain("1 transaction");
  expect(markup).toContain("3 transactions");
  expect(source).toContain("max-w-full truncate");
  expect(source).toContain("text-muted-foreground");
  expect(markup).toMatch(/Expense categories[\s\S]*Food/);
  expect(markup).toContain('style="background-color:#f6e3dc;border-color:color-mix(in srgb, #f6e3dc, black 20%);color:color-mix(in srgb, #f6e3dc, black 60%)"');
  expect((markup.match(/data-slot="badge"/g) ?? []).length).toBe(2);
  expect(markup).toContain("divide-y divide-border/70");
  expect(markup).not.toContain("rounded-lg border border-border bg-background/35");
  expect(source).toContain("SheetTrigger asChild");
  expect(source).toContain("SheetContent side=\"right\"");
  expect(source).toContain("h-dvh w-full max-w-none");
  expect(source).toContain("md:w-3/4 md:max-w-lg");
  expect(source).not.toContain("sm:w-3/4 sm:max-w-lg");
  expect(source).not.toContain("@/components/ui/dialog");
  expect(source).not.toContain("<Dialog>");
  expect(source).not.toContain("<DialogContent");
  expect(source).not.toContain("<details>");
  expect(source).not.toContain("<summary");
  expect(source).toContain("Delete category");
  expect(source).toContain("variant=\"destructive\"");
  expect(source).toContain("color={category.color}");
  expect(source).not.toContain("ArrowDownRight");
  expect(source).not.toContain("ArrowUpRight");
  expect(source).not.toContain('type="color"');
  expect(source).toContain("CategoryColorPicker");
});
