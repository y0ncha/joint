import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("@/components/category-form", () => ({
  CategorySheet: ({ defaultColor }: { defaultColor: string }) => <span data-category-sheet={defaultColor} />,
}));
vi.mock("@/components/category-list", () => ({
  CategoryList: ({ categories, subcategories }: { categories: Array<{ name: string }>; subcategories: Array<{ name: string }> }) => (
    <span data-category-list>
      {categories.map((category) => category.name).join(",")}:{subcategories.map((subcategory) => subcategory.name).join(",")}
    </span>
  ),
}));
vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) => (
    <main>
      {actions}
      {children}
    </main>
  ),
}));

const pageModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    supabase: { from: mocks.from },
    userId: "member-id",
    householdId: "household-id",
    role: "member",
  });
  mocks.order
    .mockResolvedValueOnce({ data: [{ id: "food", name: "Food", kind: "expense", color: "#dcece3", archived_at: null }] })
    .mockResolvedValueOnce({ data: [{ id: "food", name: "Food", kind: "expense", color: "#dcece3", archived_at: null }] })
    .mockResolvedValueOnce({
      data: [{ id: "groceries", category_id: "food", name: "Groceries", color: "#c5e8f7", archived_at: null, transactions: [{ count: 1 }] }],
    });
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
});

afterEach(() => vi.restoreAllMocks());

it("loads the category hierarchy through the member request context and keeps creation in the action sheet", async () => {
  const markup = renderToStaticMarkup(await pageModule.default());

  expect(markup).toContain("Food:Groceries");
  expect(markup).toContain('data-category-sheet="#b0e0e6"');
  expect(mocks.from).toHaveBeenCalledWith("categories");
  expect(mocks.from).toHaveBeenCalledWith("subcategories");
  expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.order).toHaveBeenCalledWith("kind");
  expect(mocks.order).toHaveBeenCalledWith("name");
});
