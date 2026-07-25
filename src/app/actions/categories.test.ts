import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
    supabase: { from: mocks.from },
    householdId: "household-id",
    userId: "member-id",
    role: "member",
  });
  mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("category actions", () => {
  it("creates a category with the selected color in the verified household", async () => {
    await expect(
      actions.createCategory(formData({ householdId: "other", name: "Food", kind: "expense", color: "#dcece3" })),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", name: "Food", kind: "expense", color: "#dcece3" });
  });

  it("rejects malformed category colors before creating", async () => {
    await expect(actions.createCategory(formData({ name: "Food", kind: "expense", color: "blue" }))).resolves.toMatchObject({
      status: "error",
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("archives only a category in the verified household through its request client", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.archiveCategory("category-id")).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("accepts any valid hex color while updating only the verified household category", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "#123456" }))).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Meals", kind: "expense", color: "#123456" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("rejects malformed category colors before touching data", async () => {
    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "blue" }))).resolves.toMatchObject(
      { status: "error" },
    );

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("fails before touching data for an unmatched request", async () => {
    mocks.requireCurrentHousehold.mockRejectedValue(new Error("This Google account does not have access to Joint."));

    await expect(actions.createCategory(formData({ name: "Food", kind: "expense", color: "#dcece3" }))).rejects.toThrow(
      "This Google account does not have access to Joint.",
    );
    expect(mocks.from).not.toHaveBeenCalled();
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

  it("creates a trimmed subcategory in the verified household without category fields", async () => {
    await expect(
      actions.createSubcategory(
        "category-id",
        formData({ householdId: "other-household", name: " Groceries ", kind: "expense", color: "#dcece3" }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", category_id: "category-id", name: "Groceries" });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("updates only the verified household subcategory name", async () => {
    const eqHousehold = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqHousehold });
    mocks.update.mockReturnValue({ eq: eqId });

    await expect(
      actions.updateSubcategory(
        "subcategory-id",
        formData({ householdId: "other-household", name: " Household groceries ", categoryId: "other-category" }),
      ),
    ).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Household groceries" });
    expect(eqId).toHaveBeenCalledWith("id", "subcategory-id");
    expect(eqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("archives only the verified household subcategory", async () => {
    const eqHousehold = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqHousehold });
    mocks.update.mockReturnValue({ eq: eqId });

    await expect(actions.archiveSubcategory("subcategory-id")).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("subcategories");
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(eqId).toHaveBeenCalledWith("id", "subcategory-id");
    expect(eqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });
});
