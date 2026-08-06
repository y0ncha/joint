import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/category-form", () => ({ CategorySheet: () => <span data-category-sheet /> }));
vi.mock("@/components/category-list", () => ({
  CategoryList: ({ openCategoryIds }: { openCategoryIds?: Set<string> }) => <span data-category-list={openCategoryIds?.size ?? -1} />,
}));
vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) => (
    <main>
      {actions}
      {children}
    </main>
  ),
}));

const workspaceModule = await import("./categories-workspace").catch(() => null);

it("keeps category creation as the only page-header action", () => {
  const markup = workspaceModule
    ? renderToStaticMarkup(
        <workspaceModule.CategoriesWorkspace
          categories={[{ id: "food", name: "Food", kind: "expense", color: "#dcece3", transactionCount: 0, archived_at: null }]}
          subcategories={[
            { id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", transactionCount: 0, archived_at: null },
          ]}
          defaultColor="#dcece3"
        />,
      )
    : "";

  expect(markup).not.toContain('aria-label="Collapse all categories"');
  expect(markup).toContain("data-category-sheet");
});

it("starts with every category collapsed", () => {
  const markup = workspaceModule
    ? renderToStaticMarkup(
        <workspaceModule.CategoriesWorkspace
          categories={[{ id: "food", name: "Food", kind: "expense", color: "#dcece3", transactionCount: 0, archived_at: null }]}
          subcategories={[
            { id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", transactionCount: 0, archived_at: null },
          ]}
          defaultColor="#dcece3"
        />,
      )
    : "";

  expect(markup).toContain('data-category-list="0"');
});
