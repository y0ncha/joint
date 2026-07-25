import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./profile");

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

describe("profile action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ userId: "member-id", householdId: "household-id", role: "owner", supabase: { from: mocks.from, rpc: mocks.rpc } });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("updates only the verified member profile with a trimmed name", async () => {
    await expect(actions.saveCurrentProfileName(null, formData({ name: "  Ada Lovelace  ", userId: "other-user" })))
      .resolves.toEqual({ status: "success", data: { fullName: "Ada Lovelace" } });

    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({ full_name: "Ada Lovelace" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "member-id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("rejects a blank name before writing", async () => {
    await expect(actions.saveCurrentProfileName(null, formData({ name: "   " }))).resolves.toMatchObject({ status: "error" });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts a single-word display name", async () => {
    await expect(actions.saveCurrentProfileName(null, formData({ name: "Yonatan" }))).resolves.toEqual({
      status: "success", data: { fullName: "Yonatan" },
    });

    expect(mocks.update).toHaveBeenCalledWith({ full_name: "Yonatan" });
  });

  it("saves the current member's selected hex color without a target user", async () => {
    await expect(actions.saveCurrentMemberColor("#123456")).resolves.toEqual({ status: "success" });

    expect(mocks.rpc).toHaveBeenCalledWith("set_current_household_member_color", { target_color: "#123456" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("rejects malformed current member colors", async () => {
    await expect(actions.saveCurrentMemberColor("blue")).resolves.toMatchObject({ status: "error" });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("lets an owner rename the verified household", async () => {
    await expect(actions.saveCurrentHouseholdName(null, formData({ name: "  The Lovelaces  " }))).resolves.toEqual({
      status: "success", data: { name: "The Lovelaces" },
    });

    expect(mocks.from).toHaveBeenCalledWith("households");
    expect(mocks.update).toHaveBeenCalledWith({ name: "The Lovelaces" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "household-id");
  });

  it("rejects household renames from members before writing", async () => {
    mocks.requireCurrentHousehold.mockResolvedValue({ userId: "member-id", householdId: "household-id", role: "member", supabase: { from: mocks.from, rpc: mocks.rpc } });

    await expect(actions.saveCurrentHouseholdName(null, formData({ name: "Other household" }))).resolves.toMatchObject({ status: "error" });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("saves only changed settings in one explicit action", async () => {
    await expect(actions.saveSettings(null, formData({
      profileName: "Ada Lovelace",
      initialProfileName: "Ada",
      householdName: "The Lovelaces",
      initialHouseholdName: "Household",
      color: "#123456",
      initialColor: "#dcece3",
    }))).resolves.toEqual({ status: "success", data: { fullName: "Ada Lovelace" } });

    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.from).toHaveBeenCalledWith("households");
    expect(mocks.rpc).toHaveBeenCalledWith("set_current_household_member_color", { target_color: "#123456" });
  });

  it("does not write unchanged settings", async () => {
    await expect(actions.saveSettings(null, formData({
      profileName: "Ada",
      initialProfileName: "Ada",
      householdName: "Household",
      initialHouseholdName: "Household",
      color: "#dcece3",
      initialColor: "#dcece3",
    }))).resolves.toEqual({ status: "success", data: { fullName: "Ada" } });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
