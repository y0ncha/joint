import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createServerSupabaseClient: vi.fn(), requireCurrentHousehold: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const actions = await import("./categories").catch(() => null);
function formData(values: Record<string, string>) { const input = new FormData(); Object.entries(values).forEach(([key, value]) => input.set(key, value)); return input; }
describe("createCategory", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from }); mocks.requireCurrentHousehold.mockResolvedValue({ householdId: "household-id", userId: "member-id", role: "member" }); mocks.from.mockReturnValue({ insert: mocks.insert }); mocks.insert.mockResolvedValue({ error: null }); });
  it("uses the verified household", async () => {
    await expect(actions?.createCategory(formData({ householdId: "other", name: "Food", kind: "expense" }))).resolves.toEqual({ status: "success" });
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", name: "Food", kind: "expense" });
  });

  it("archives only a category in the verified household", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });
    mocks.from.mockReturnValue({ update: mocks.update });
    await expect(actions?.archiveCategory("category-id")).resolves.toEqual({ status: "success" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });
});
