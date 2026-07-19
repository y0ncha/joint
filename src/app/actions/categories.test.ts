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
  it("uses the verified household and its request client", async () => {
    await expect(actions.createCategory(formData({ householdId: "other", name: "Food", kind: "expense" }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", name: "Food", kind: "expense" });
  });

  it("archives only a category in the verified household through its request client", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.archiveCategory("category-id")).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("updates only a category in the verified household through its request client", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });

    await expect(actions.updateCategory("category-id", formData({ name: "Meals", kind: "expense" }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("categories");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Meals", kind: "expense" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("fails before touching data for an unmatched request", async () => {
    mocks.requireCurrentHousehold.mockRejectedValue(new Error("This Google account does not have access to Joint."));

    await expect(actions.createCategory(formData({ name: "Food", kind: "expense" }))).rejects.toThrow(
      "This Google account does not have access to Joint.",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
