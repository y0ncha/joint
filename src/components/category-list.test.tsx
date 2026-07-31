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
  expect(markup).not.toContain("--subcategory-color");
  expect(markup).not.toContain("before:w-1");
  expect(markup).toContain("before:w-[3px]");
  expect(markup).toContain("md:min-h-9");
  expect(markup).toContain('class="px-7 pb-2"');
  expect(markup).toContain('class="flex flex-col gap-0"');
  expect(markup).toContain('class="group/category flex flex-col gap-0"');
  expect(markup).not.toContain("border-sidebar-border/70");
  expect(markup).toContain("size-4 shrink-0");
  expect(markup).toContain('class="truncate px-1.5"');
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

it("limits protected BillsGroceries rows to appearance controls", () => {
  const markup = categoryListModule
    ? renderToStaticMarkup(
        <categoryListModule.CategoryList
          categories={[
            {
              id: "groceries",
              name: "Groceries",
              kind: "expense",
              color: "#dcece3",
              transactionCount: 0,
              archived_at: null,
              system_key: "groceries",
            },
          ]}
          subcategories={[
            {
              id: "main-run",
              category_id: "groceries",
              name: "Main run",
              color: "#c5e8f7",
              transactionCount: 0,
              archived_at: null,
              system_key: "main_run",
            },
          ]}
        />,
      )
    : "";

  expect(markup).not.toContain("Add subcategory");
  expect(markup).not.toContain("Delete category");
  expect(markup).not.toContain("Delete subcategory");
  expect(markup).not.toContain("Category type");
  expect(markup).not.toContain("Parent category");
});

it("places independent collapse actions in each category card", () => {
  const markup = categoryListModule
    ? renderToStaticMarkup(
        <categoryListModule.CategoryList
          categories={[
            { id: "food", name: "Food", kind: "expense", color: "#dcece3", transactionCount: 0, archived_at: null },
            { id: "salary", name: "Salary", kind: "income", color: "#e0f2fe", transactionCount: 0, archived_at: null },
          ]}
          subcategories={[
            { id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", transactionCount: 0, archived_at: null },
            { id: "monthly", category_id: "salary", name: "Monthly", color: "#c5e8f7", transactionCount: 0, archived_at: null },
          ]}
          openCategoryIds={new Set(["food", "salary"])}
          onSectionOpenChange={() => {}}
        />,
      )
    : "";

  expect(markup).toContain('aria-label="Collapse expense categories"');
  expect(markup).toContain('aria-label="Collapse income categories"');
  expect(markup).toContain("lucide-fold-vertical");
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
