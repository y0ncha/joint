import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const transactionsModule = await import("./transactions");

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

describe("createTransaction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
    mocks.requireCurrentHousehold.mockResolvedValue({ userId: "member-id", householdId: "household-id", role: "member" });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("derives household and creator from verified membership", async () => {
    const accountMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "shared-account-id" }, error: null });
    const accountLimit = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
    const accountOrder = vi.fn().mockReturnValue({ limit: accountLimit });
    const accountIs = vi.fn().mockReturnValue({ order: accountOrder });
    const accountEqKind = vi.fn().mockReturnValue({ is: accountIs });
    const accountEqHousehold = vi.fn().mockReturnValue({ eq: accountEqKind });
    const accountSelect = vi.fn().mockReturnValue({ eq: accountEqHousehold });
    const memberMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "partner-id" }, error: null });
    const memberEqUser = vi.fn().mockReturnValue({ maybeSingle: memberMaybeSingle });
    const memberEqHousehold = vi.fn().mockReturnValue({ eq: memberEqUser });
    const memberSelect = vi.fn().mockReturnValue({ eq: memberEqHousehold });
    mocks.from.mockImplementation((table: string) => {
      if (table === "accounts") return { select: accountSelect };
      if (table === "household_members") return { select: memberSelect };
      if (table === "transactions") return { insert: mocks.insert };
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(transactionsModule.createTransaction(formData({
      householdId: "other-household",
      kind: "expense",
      amount: "50",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "partner-id",
      note: "Groceries",
    }))).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith({
      household_id: "household-id",
      created_by: "member-id",
      paid_by: "partner-id",
      kind: "expense",
      amount: 50,
      occurred_on: "2026-07-14",
      account_id: "shared-account-id",
      destination_account_id: null,
      category_id: "food",
      note: "Groceries",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("scopes deletion to the verified household", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.delete.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });
    mocks.from.mockReturnValue({ delete: mocks.delete });

    await expect(transactionsModule.deleteTransaction("transaction-id")).resolves.toEqual({ status: "success" });

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("scopes updates to the verified household", async () => {
    const accountMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "shared-account-id" }, error: null });
    const accountLimit = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
    const accountOrder = vi.fn().mockReturnValue({ limit: accountLimit });
    const accountIs = vi.fn().mockReturnValue({ order: accountOrder });
    const accountEqKind = vi.fn().mockReturnValue({ is: accountIs });
    const accountEqHousehold = vi.fn().mockReturnValue({ eq: accountEqKind });
    const accountSelect = vi.fn().mockReturnValue({ eq: accountEqHousehold });
    const memberMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "member-id" }, error: null });
    const memberEqUser = vi.fn().mockReturnValue({ maybeSingle: memberMaybeSingle });
    const memberEqHousehold = vi.fn().mockReturnValue({ eq: memberEqUser });
    const memberSelect = vi.fn().mockReturnValue({ eq: memberEqHousehold });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });
    mocks.from.mockImplementation((table: string) => {
      if (table === "accounts") return { select: accountSelect };
      if (table === "household_members") return { select: memberSelect };
      if (table === "transactions") return { update: mocks.update };
      throw new Error(`Unexpected table: ${table}`);
    });
    await expect(transactionsModule.updateTransaction("transaction-id", formData({ kind: "expense", amount: "51", occurredOn: "2026-07-14", categoryId: "food", paidBy: "member-id", note: "Updated" }))).resolves.toEqual({ status: "success" });
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("rejects transfer submissions at the action boundary", async () => {
    await expect(transactionsModule.createTransaction(formData({
      kind: "transfer",
      amount: "50",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "member-id",
      note: "Transfer",
    }))).resolves.toMatchObject({ status: "error" });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
