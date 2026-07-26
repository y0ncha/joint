import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/category-form", () => ({ CategorySheet: () => <span data-category-sheet /> }));
vi.mock("@/components/category-list", () => ({ CategoryList: () => <span data-category-list /> }));
vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) => (
    <main>
      {actions}
      {children}
    </main>
  ),
}));

const workspaceModule = await import("./categories-workspace").catch(() => null);

it("puts the collapse-all action before category creation", () => {
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

  expect(markup).toMatch(/aria-label="Collapse all categories"[\s\S]*data-category-sheet/);
  expect(markup).toContain("lucide-chevrons-up");
});
