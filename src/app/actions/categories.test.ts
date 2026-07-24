import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
    await expect(actions.createCategory(formData({ householdId: "other", name: "Food", kind: "expense", color: "#dcece3" }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", name: "Food", kind: "expense", color: "#dcece3" });
  });

  it("rejects malformed category colors before creating", async () => {
    await expect(actions.createCategory(formData({ name: "Food", kind: "expense", color: "blue" }))).resolves.toMatchObject({ status: "error" });

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

    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "#123456" }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Meals", kind: "expense", color: "#123456" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("rejects malformed category colors before touching data", async () => {
    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense", color: "blue" }))).resolves.toMatchObject({ status: "error" });

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
