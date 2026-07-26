import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const categoryListModule = await import("./category-list").catch(() => null);
it("shows a truthful category empty state", () => {
  const markup = categoryListModule ? renderToStaticMarkup(<categoryListModule.CategoryList categories={[]} />) : "";
  expect(markup).toContain("Expense categories");
  expect(markup).toContain("Income categories");
  expect(markup).toContain("No expense subcategories yet");
  expect(markup).toContain("No income subcategories yet");
  expect(markup).not.toContain("Categories used for shared spending.");
  expect(markup).not.toContain("Categories used for shared income.");
});

it("shows category and subcategory names without pills", () => {
  const markup = categoryListModule
    ? renderToStaticMarkup(
        <categoryListModule.CategoryList
          categories={[
            { id: "income-id", name: "Salary", kind: "income", color: "#e0f2fe", transactionCount: 1, archived_at: null },
            {
              id: "expense-id",
              name: "Food",
              kind: "expense",
              color: "#dcece3",
              icon: "shopping-basket",
              transactionCount: 3,
              archived_at: null,
            },
          ]}
          subcategories={[
            { id: "groceries", category_id: "expense-id", name: "Groceries", color: "#c5e8f7", transactionCount: 2, archived_at: null },
            {
              id: "takeaway",
              category_id: "expense-id",
              name: "Takeaway",
              color: "#aec6cf",
              transactionCount: 1,
              archived_at: "2026-07-26",
            },
          ]}
        />,
      )
    : "";

  expect(markup).not.toContain("3 transactions");
  expect(markup).not.toContain("1 transaction");
  expect(markup).not.toContain('data-slot="badge"');
  expect(markup).toContain('aria-label="Manage Food category"');
  expect(markup).toContain('data-category-icon="shopping-basket"');
  expect(markup).toContain('aria-label="Manage Groceries subcategory"');
  expect(markup).not.toContain("Salary");
  expect(markup).not.toContain("Add subcategory");
  expect(markup).not.toContain("Edit Groceries");
  expect(markup).toMatch(/Food[\s\S]*Groceries[\s\S]*Takeaway[\s\S]*Archived/);
  expect(markup).toMatch(/Food[\s\S]*data-category-icon="shopping-basket"/);
  expect(markup).toContain("--category-color:#dcece3");
  expect(markup).toContain("--subcategory-color:#c5e8f7");
  expect(markup).toContain("before:w-1");
  expect(markup).toContain("before:w-[3px]");
  expect(markup).toContain('class="px-7 pb-2"');
  expect(markup).toContain('class="flex flex-col gap-1 border-s-[3px] border-sidebar-border/70 ps-6"');
  expect(markup).toContain("size-4 shrink-0");
  expect(markup).toContain("font-semibold");
  expect(markup).toContain("transition-transform motion-reduce:transition-none");
  expect(markup).toContain("data-[state=open]:animate-[collapsible-down_160ms_ease-out]");
  expect(markup).toContain("motion-reduce:animate-none");
  expect(markup).not.toContain("border-y");
  expect(markup).not.toContain("border-e");
  expect(markup).not.toContain("border-l");
  expect(markup).not.toContain("background-color:#dcece3");
  expect(markup).not.toContain("background-color:#c5e8f7");
});

it("uses the supplied global state to collapse every category group", () => {
  const markup = categoryListModule
    ? renderToStaticMarkup(
        <categoryListModule.CategoryList
          categories={[{ id: "food", name: "Food", kind: "expense", color: "#dcece3", transactionCount: 0, archived_at: null }]}
          subcategories={[
            { id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", transactionCount: 0, archived_at: null },
          ]}
          openCategoryIds={new Set()}
        />,
      )
    : "";

  expect(markup).toMatch(/aria-label="Toggle Food subcategories"[\s\S]*aria-expanded="false"/);
});
