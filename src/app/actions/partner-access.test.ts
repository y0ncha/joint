import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  insertSelect: vi.fn(),
  insertSingle: vi.fn(),
  authorizationDelete: vi.fn(),
  authorizationEq: vi.fn(),
  authorizationSelect: vi.fn(),
  authorizationMaybeSingle: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./partner-access");

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

describe("partner access actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      supabase: { from: mocks.from },
      householdId: "household-id",
      userId: "owner-id",
      role: "owner",
    });
    mocks.from.mockReturnValue({ insert: mocks.insert, delete: mocks.authorizationDelete });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.insertSingle });
    mocks.insertSingle.mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    mocks.authorizationDelete.mockReturnValue({ eq: mocks.authorizationEq });
    mocks.authorizationEq.mockReturnValue({ select: mocks.authorizationSelect });
    mocks.authorizationSelect.mockReturnValue({ maybeSingle: mocks.authorizationMaybeSingle });
    mocks.authorizationMaybeSingle.mockResolvedValue({ data: { household_id: "household-id" }, error: null });
  });

  it("inserts one normalized authorization through the verified owner request context", async () => {
    await expect(actions.setAllowedPartnerEmail(formData({ householdId: "other-household", email: " Partner@Example.com " }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", email: "partner@example.com" });
    expect(mocks.insertSelect).toHaveBeenCalledWith("household_id");
    expect(mocks.insertSingle).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("returns a sanitized conflict when authorization already exists", async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value reveals internal constraint" } });

    await expect(actions.setAllowedPartnerEmail(formData({ email: "partner@example.com" }))).resolves.toEqual({
      status: "error", formError: "Partner access already exists. Remove it before authorizing another email.", fieldErrors: {},
    });
  });

  it("requires exactly one inserted authorization", async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: null });

    await expect(actions.setAllowedPartnerEmail(formData({ email: "partner@example.com" }))).resolves.toEqual({
      status: "error", formError: "Unable to authorize partner access. Please try again.", fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a non-owner before accessing partner authorization", async () => {
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member", supabase: { from: mocks.from }, householdId: "household-id", userId: "member-id", role: "member",
    });

    await expect(actions.setAllowedPartnerEmail(formData({ email: "partner@example.com" }))).resolves.toEqual({
      status: "error", formError: "Only the household owner can manage partner access.", fieldErrors: {},
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("removes exactly one authorization through the context client", async () => {
    await expect(actions.removePartner()).resolves.toEqual({ status: "success" });

    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
    expect(mocks.authorizationDelete).toHaveBeenCalledOnce();
    expect(mocks.authorizationEq).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.authorizationSelect).toHaveBeenCalledWith("household_id");
    expect(mocks.authorizationMaybeSingle).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("fails safely when there is no partner access to remove", async () => {
    mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(actions.removePartner()).resolves.toEqual({
      status: "error", formError: "Unable to remove partner access. Please refresh and try again.", fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("fails safely when authorization removal errors", async () => {
    mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: { message: "database detail" } });

    await expect(actions.removePartner()).resolves.toEqual({
      status: "error", formError: "Unable to remove partner access. Please refresh and try again.", fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
