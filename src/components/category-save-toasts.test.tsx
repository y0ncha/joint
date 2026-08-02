import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: null as null | { status: "success" } | { status: "error"; formError: string; fieldErrors: Record<string, string> },
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [mocks.actionState, () => {}, false],
    useEffect: (effect: () => void) => effect(),
  };
});
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/app/actions/categories", () => ({
  createCategory: vi.fn(),
  createSubcategory: vi.fn(),
  updateCategory: vi.fn(),
  updateSubcategory: vi.fn(),
}));

const { CategoryCreationPreview } = await import("./category-form");
const { CategoryList } = await import("./category-list");
const { SubcategoryEditForm } = await import("./subcategory-edit-form");

it("shows success and error toasts for category save forms", () => {
  mocks.actionState = { status: "success" };
  renderToStaticMarkup(<CategoryCreationPreview />);
  renderToStaticMarkup(
    <CategoryCreationPreview
      categories={[{ id: "food", name: "Food", kind: "expense", color: "#dcece3" }]}
      initialCategoryId="food"
      initialMode="subcategory"
      modeLocked
    />,
  );
  renderToStaticMarkup(
    <CategoryList
      categories={[{ id: "food", name: "Food", kind: "expense", color: "#dcece3", transactionCount: 0, archived_at: null }]}
      subcategories={[
        { id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", transactionCount: 0, archived_at: null },
      ]}
    />,
  );
  renderToStaticMarkup(
    <SubcategoryEditForm
      subcategory={{ id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", icon: null }}
      categories={[{ id: "food", name: "Food", color: "#dcece3", subcategoryColors: [] }]}
    />,
  );

  expect(mocks.success).toHaveBeenCalledWith("Saved", { id: "category-save" });
  expect(mocks.success).toHaveBeenCalledWith("Saved", { id: "subcategory-save" });

  mocks.success.mockClear();
  mocks.actionState = { status: "error", formError: "Unable to save.", fieldErrors: {} };
  renderToStaticMarkup(<CategoryCreationPreview />);
  expect(mocks.error).toHaveBeenCalledWith("Unable to save.", { id: "category-save" });
});
