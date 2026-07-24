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
    mocks.requireCurrentHousehold.mockResolvedValue({ userId: "member-id", supabase: { from: mocks.from, rpc: mocks.rpc } });
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

  it("requires a first and last name before writing", async () => {
    await expect(actions.saveCurrentProfileName(null, formData({ name: "Yonatan" }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { name: "Enter your first and last name." },
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("saves a household member's selected hex color", async () => {
    await expect(actions.saveMemberColor("partner-id", "#123456")).resolves.toEqual({ status: "success" });

    expect(mocks.rpc).toHaveBeenCalledWith("set_household_member_color", { target_user_id: "partner-id", target_color: "#123456" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("rejects malformed member colors", async () => {
    await expect(actions.saveMemberColor("partner-id", "blue")).resolves.toMatchObject({ status: "error" });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
