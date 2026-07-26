import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./categories");

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireCurrentHousehold.mockResolvedValue({
    status: "member",
    supabase: { from: mocks.from, rpc: mocks.rpc },
    householdId: "household-id",
    userId: "member-id",
    role: "member",
  });
  mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update, delete: mocks.delete });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("category actions", () => {
  it("creates a standalone category with an anchor color", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await expect(actions.createCategory(formData({ name: "Meals", kind: "expense", color: "#ccebef", icon: "utensils" }))).resolves.toEqual({ status: "success" });

    expect(mocks.rpc).toHaveBeenCalledWith("create_category", {
      category_name: "Meals",
      category_kind: "expense",
      category_color: "#ccebef",
      category_icon: "utensils",
    });
  });
  it("deletes only a category in the verified household through its request client", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.delete.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.deleteCategory("category-id")).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("accepts an anchor color while updating only the verified household category", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "#ccebef", icon: "utensils" }))).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Meals", kind: "expense", color: "#ccebef", icon: "utensils" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("rejects a child color before touching data", async () => {
    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "#C5E8F7", icon: "utensils" }))).resolves.toMatchObject(
      { status: "error" },
    );

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an icon outside the curated set before touching data", async () => {
    await expect(actions.createCategory(formData({ name: "Meals", kind: "expense", color: "#ccebef", icon: "emoji" }))).resolves.toMatchObject({
      status: "error",
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("subcategory actions", () => {
  it.each([
    ["create", () => actions.createSubcategory("category-id", formData({ name: " " }))],
    ["update", () => actions.updateSubcategory("subcategory-id", formData({ name: "x".repeat(81) }))],
  ])("rejects a malformed subcategory name before %s touches data", async (_, action) => {
    await expect(action()).resolves.toMatchObject({ status: "error" });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates a trimmed subcategory with its selected child color", async () => {
    await expect(
      actions.createSubcategory(
        "category-id",
        formData({ householdId: "other-household", name: " Groceries ", kind: "expense", color: "#c5e8f7" }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", category_id: "category-id", name: "Groceries", color: "#c5e8f7" });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("updates the verified household subcategory name, color, and icon override", async () => {
    const eqHousehold = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqHousehold });
    mocks.update.mockReturnValue({ eq: eqId });

    await expect(
      actions.updateSubcategory(
        "subcategory-id",
        formData({ householdId: "other-household", name: " Household groceries ", categoryId: "00000000-0000-4000-8000-000000000001", color: "#aec6cf", icon: "shopping-basket" }),
      ),
    ).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.update).toHaveBeenCalledWith({ category_id: "00000000-0000-4000-8000-000000000001", name: "Household groceries", color: "#aec6cf", icon: "shopping-basket" });
    expect(eqId).toHaveBeenCalledWith("id", "subcategory-id");
    expect(eqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("deletes only the verified household subcategory", async () => {
    const eqHousehold = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqHousehold });
    mocks.delete.mockReturnValue({ eq: eqId });

    await expect(actions.deleteSubcategory("subcategory-id")).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(eqId).toHaveBeenCalledWith("id", "subcategory-id");
    expect(eqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });
});
