import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
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
  expect(markup).toMatch(/Expense categories[\s\S]*Food/);
  expect(markup).toContain('style="background-color:#f6e3dc;border-color:color-mix(in srgb, #f6e3dc, black 20%);color:color-mix(in srgb, #f6e3dc, black 60%)"');
  expect((markup.match(/data-slot="badge"/g) ?? []).length).toBe(2);
  expect(markup).toContain("divide-y divide-border/70");
  expect(markup).not.toContain("rounded-lg border border-border bg-background/35");
});
