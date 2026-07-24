import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const categoryListModule = await import("./category-list").catch(() => null);
it("shows a truthful category empty state", () => {
  const markup = categoryListModule ? renderToStaticMarkup(<categoryListModule.CategoryList categories={[]} />) : "";
  expect(markup).toContain("Expense categories");
  expect(markup).toContain("Income categories");
  expect(markup).toContain("No expense categories yet");
  expect(markup).toContain("No income categories yet");
});

it("groups populated categories and shows their transaction counts", () => {
  const markup = categoryListModule ? renderToStaticMarkup(
    <categoryListModule.CategoryList categories={[
      { id: "income-id", name: "Salary", kind: "income", transactionCount: 1, archived_at: null },
      { id: "expense-id", name: "Food", kind: "expense", transactionCount: 3, archived_at: null },
    ]} />,
  ) : "";

  expect(markup).toMatch(/Expense categories[\s\S]*Food[\s\S]*3 transactions/);
  expect(markup).toMatch(/Income categories[\s\S]*Salary[\s\S]*1 transaction/);
});
