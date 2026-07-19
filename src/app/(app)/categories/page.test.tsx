import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("@/components/category-form", () => ({ CategorySheet: () => <span data-category-sheet /> }));
vi.mock("@/components/category-list", () => ({ CategoryList: ({ categories }: { categories: Array<{ name: string }> }) => <span data-category-list>{categories.map((category) => category.name).join(",")}</span> }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) => <main>{actions}{children}</main> }));

const pageModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "member-id", householdId: "household-id", role: "member",
  });
  mocks.order.mockResolvedValue({ data: [{ id: "food", name: "Food", kind: "expense", archived_at: null }] });
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
});

it("loads categories through the member request context and keeps creation in the action sheet", async () => {
  const markup = renderToStaticMarkup(await pageModule.default());

  expect(markup).toContain("data-category-sheet");
  expect(markup).toContain("data-category-list");
  expect(markup).toContain("Food");
  expect(mocks.from).toHaveBeenCalledWith("categories");
  expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.order).toHaveBeenCalledWith("kind");
  expect(mocks.order).toHaveBeenCalledWith("name");
});
