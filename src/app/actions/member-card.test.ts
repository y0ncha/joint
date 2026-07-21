import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./member-card");

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

describe("member card action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      supabase: { from: mocks.from },
      householdId: "household-id",
      userId: "member-id",
      role: "member",
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("derives a first mapping from verified membership instead of form identifiers", async () => {
    await expect(actions.saveCurrentMemberCard(null, formData({ lastFour: "4548", householdId: "other-household", userId: "other-user" })))
      .resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("member_card_mappings");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", user_id: "member-id", last_four: "4548" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/setup/card");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions/import");
  });

  it("rejects a non-four-digit mapping before writing", async () => {
    await expect(actions.saveCurrentMemberCard(null, formData({ lastFour: "454" }))).resolves.toMatchObject({ status: "error" });

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a second mapping for the current member without exposing database details", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "member_card_mappings_pkey" } });

    await expect(actions.saveCurrentMemberCard(null, formData({ lastFour: "4548" }))).resolves.toEqual({
      status: "error",
      formError: "You already have a card mapping.",
      fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("handles a duplicate household card value as a safe field error", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "member_card_mappings_household_id_last_four_key" } });

    await expect(actions.saveCurrentMemberCard(null, formData({ lastFour: "4548" }))).resolves.toEqual({
      status: "error",
      formError: "Check the form details.",
      fieldErrors: { lastFour: "These last four digits are already mapped in this household." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
