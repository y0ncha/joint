import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

const householdModule = await import("./household");

describe("requireCurrentHousehold", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims }, from: mocks.from });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } });
    mocks.maybeSingle.mockResolvedValue({ data: { household_id: "household-id", role: "member" }, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("returns verified user and membership identifiers", async () => {
    await expect(householdModule.requireCurrentHousehold()).resolves.toEqual({
      userId: "member-id",
      householdId: "household-id",
      role: "member",
    });
  });

  it("denies a verified user without household membership", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(householdModule.requireCurrentHousehold()).rejects.toThrow(
      "This Google account does not have access to Joint.",
    );
  });
});

describe("ensurePartnerMembership", () => {
  it("joins the verified user when their email matches the household authorization", async () => {
    const ensurePartnerMembership = Reflect.get(householdModule, "ensurePartnerMembership");
    expect(typeof ensurePartnerMembership).toBe("function");
    if (typeof ensurePartnerMembership !== "function") return;

    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "household-id", role: "member" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(ensurePartnerMembership(supabase, { userId: "partner-id", email: " Partner@Example.com " })).resolves.toBe("joined");
    expect(authorizationEmail).toHaveBeenCalledWith("email", "partner@example.com");
    expect(insert).toHaveBeenCalledWith({ household_id: "household-id", user_id: "partner-id", role: "member" });
  });

  it("returns unmatched when a permission failure is confirmed by a fresh missing authorization", async () => {
    const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { household_id: "household-id" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({
      error: { code: "42501", message: "Partner authorization is required" },
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).resolves.toBe("unmatched");
    expect(authorizationMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it("rethrows a permission failure when the fresh authorization still exists", async () => {
    const permissionError = { code: "42501", message: "permission denied" };
    const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({ error: permissionError });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).rejects.toBe(permissionError);
    expect(authorizationMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it("does not hide unrelated unique constraint failures", async () => {
    const unrelatedConflict = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "other_constraint"',
    };
    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "household-id", role: "member" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({ error: unrelatedConflict });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).rejects.toBe(unrelatedConflict);
  });

  it("recovers when another request creates the same user membership first", async () => {
    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "household-id", role: "member" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "household_members_user_id_key"',
      },
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).resolves.toBe("existing");
  });

  it("recovers when another request creates the same household membership first", async () => {
    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "household-id", role: "member" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "household_members_pkey"',
      },
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).resolves.toBe("existing");
  });

  it("does not recover a membership race into a different household", async () => {
    const conflict = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "household_members_user_id_key"',
    };
    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "other-household-id", role: "member" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({ error: conflict });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).rejects.toBe(conflict);
  });

  it("does not recover a membership race into an owner role", async () => {
    const conflict = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "household_members_user_id_key"',
    };
    const membershipMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { household_id: "household-id", role: "owner" }, error: null });
    const membershipUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });
    const authorizationMaybeSingle = vi.fn().mockResolvedValue({ data: { household_id: "household-id" }, error: null });
    const authorizationEmail = vi.fn().mockReturnValue({ maybeSingle: authorizationMaybeSingle });
    const authorizationSelect = vi.fn().mockReturnValue({ eq: authorizationEmail });
    const insert = vi.fn().mockResolvedValue({ error: conflict });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "household_members") return { select: membershipSelect, insert };
        if (table === "household_allowed_members") return { select: authorizationSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(householdModule.ensurePartnerMembership(supabase as never, {
      userId: "partner-id",
      email: "partner@example.com",
    })).rejects.toBe(conflict);
  });
});
