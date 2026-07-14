import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  getCurrentHousehold: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("@/lib/household", () => ({
  getCurrentHousehold: mocks.getCurrentHousehold,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { acceptInvitation, createHousehold } from "./household";

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

describe("household actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
      from: mocks.from,
    });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } });
    mocks.getCurrentHousehold.mockResolvedValue(null);
  });

  it("rejects household creation when the member already belongs to one", async () => {
    mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });

    await expect(createHousehold(formData({ name: "Our home" }))).resolves.toEqual({
      status: "error",
      formError: "You already belong to a household.",
      fieldErrors: {},
    });
  });

  it("reports an existing household when creation loses the membership race", async () => {
    const householdSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        details: "Key (user_id)=(member-id) already exists.",
        hint: null,
        message: "duplicate key value violates unique constraint \"household_members_user_id_key\"",
      },
    });
    const householdSelect = vi.fn().mockReturnValue({ single: householdSingle });
    const householdInsert = vi.fn().mockReturnValue({ select: householdSelect });
    mocks.from.mockReturnValue({ insert: householdInsert });

    await expect(createHousehold(formData({ name: "Our home" }))).resolves.toEqual({
      status: "error",
      formError: "You already belong to a household.",
      fieldErrors: {},
    });
  });

  it("accepts an active invitation through the invitee-only RLS policies", async () => {
    const invitationMaybeSingle = vi.fn().mockResolvedValue({
      data: { household_id: "household-id" },
      error: null,
    });
    const invitationEq = vi.fn().mockReturnValue({ maybeSingle: invitationMaybeSingle });
    const invitationSelect = vi.fn().mockReturnValue({ eq: invitationEq });
    const membershipInsert = vi.fn().mockResolvedValue({ error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "invitations") return { select: invitationSelect };
      if (table === "household_members") return { insert: membershipInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    await acceptInvitation(formData({ token: "invite-token" }));

    expect(invitationSelect).toHaveBeenCalledWith("household_id");
    expect(invitationEq).toHaveBeenCalledWith("token", "invite-token");
    expect(membershipInsert).toHaveBeenCalledWith({
      household_id: "household-id",
      user_id: "member-id",
      role: "member",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("does not accept an invitation without verified claims", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });

    await expect(acceptInvitation(formData({ token: "invite-token" }))).resolves.toEqual({
      status: "error",
      formError: "Please sign in before accepting an invitation.",
      fieldErrors: {},
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an invitation when the signed-in user already belongs to a household", async () => {
    mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "member" });

    await expect(acceptInvitation(formData({ token: "invite-token" }))).resolves.toEqual({
      status: "error",
      formError: "You already belong to a household.",
      fieldErrors: {},
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reports an existing household when invitation acceptance loses the membership race", async () => {
    const invitationMaybeSingle = vi.fn().mockResolvedValue({
      data: { household_id: "household-id" },
      error: null,
    });
    const invitationEq = vi.fn().mockReturnValue({ maybeSingle: invitationMaybeSingle });
    const invitationSelect = vi.fn().mockReturnValue({ eq: invitationEq });
    const membershipInsert = vi.fn().mockResolvedValue({
      error: {
        code: "23505",
        details: "violates unique constraint \"household_members_user_id_key\"",
        hint: null,
        message: "duplicate key value violates unique constraint",
      },
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "invitations") return { select: invitationSelect };
      if (table === "household_members") return { insert: membershipInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(acceptInvitation(formData({ token: "invite-token" }))).resolves.toEqual({
      status: "error",
      formError: "You already belong to a household.",
      fieldErrors: {},
    });
  });
});
