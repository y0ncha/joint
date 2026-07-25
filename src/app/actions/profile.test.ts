import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
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
    mocks.requireCurrentHousehold.mockResolvedValue({
      userId: "member-id",
      householdId: "household-id",
      role: "owner",
      supabase: { from: mocks.from, rpc: mocks.rpc },
    });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("saves only changed settings in one explicit action", async () => {
    await expect(
      actions.saveSettings(
        null,
        formData({
          profileName: "Ada Lovelace",
          initialProfileName: "Ada",
          householdName: "The Lovelaces",
          initialHouseholdName: "Household",
          color: "#123456",
          initialColor: "#dcece3",
        }),
      ),
    ).resolves.toEqual({ status: "success", data: { fullName: "Ada Lovelace" } });

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("save_current_settings", {
      profile_name: "Ada Lovelace",
      household_name: "The Lovelaces",
      member_color: "#123456",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("saves changed settings through one RPC with null unchanged values", async () => {
    await expect(
      actions.saveSettings(
        null,
        formData({
          profileName: "Ada Lovelace",
          initialProfileName: "Ada",
          householdName: "Household",
          initialHouseholdName: "Household",
          color: "#dcece3",
          initialColor: "#dcece3",
        }),
      ),
    ).resolves.toEqual({ status: "success", data: { fullName: "Ada Lovelace" } });

    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("save_current_settings", {
      profile_name: "Ada Lovelace",
      household_name: null,
      member_color: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not write unchanged settings", async () => {
    await expect(
      actions.saveSettings(
        null,
        formData({
          profileName: "Ada",
          initialProfileName: "Ada",
          householdName: "Household",
          initialHouseholdName: "Household",
          color: "#dcece3",
          initialColor: "#dcece3",
        }),
      ),
    ).resolves.toEqual({ status: "success", data: { fullName: "Ada" } });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
