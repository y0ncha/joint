import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
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

function transactionForm(overrides: Record<string, string> = {}) {
  return formData({
    kind: "expense",
    amount: "50",
    occurredOn: "2026-07-14",
    categoryId: "food",
    paidBy: "partner-id",
    note: "Groceries",
    ...overrides,
  });
}

function configureSupabase({ payer = { user_id: "partner-id" }, transactionError = null }: {
  payer?: { user_id: string } | null;
  transactionError?: unknown;
} = {}) {
  const payerMaybeSingle = vi.fn().mockResolvedValue({ data: payer, error: null });
  const payerEqUser = vi.fn().mockReturnValue({ maybeSingle: payerMaybeSingle });
  const payerEqHousehold = vi.fn().mockReturnValue({ eq: payerEqUser });
  const payerSelect = vi.fn().mockReturnValue({ eq: payerEqHousehold });
  const transactionEqHousehold = vi.fn().mockResolvedValue({ error: transactionError });
  const transactionEqId = vi.fn().mockReturnValue({ eq: transactionEqHousehold });

  mocks.insert.mockResolvedValue({ error: transactionError });
  mocks.update.mockReturnValue({ eq: transactionEqId });
  mocks.delete.mockReturnValue({ eq: transactionEqId });
  mocks.from.mockImplementation((table: string) => {
    if (table === "household_members") return { select: payerSelect };
    if (table === "transactions") return { insert: mocks.insert, update: mocks.update, delete: mocks.delete };
    throw new Error(`Unexpected table: ${table}`);
  });

  return { payerSelect, transactionEqHousehold, transactionEqId };
}

describe("transaction actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
    mocks.requireCurrentHousehold.mockResolvedValue({ userId: "member-id", householdId: "household-id", role: "member" });
  });

  it("creates an account-free transaction from verified household membership", async () => {
    configureSupabase();

    await expect(transactionsModule.createTransaction(transactionForm({ householdId: "other-household" }))).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith({
      household_id: "household-id",
      created_by: "member-id",
      paid_by: "partner-id",
      kind: "expense",
      amount: 50,
      occurred_on: "2026-07-14",
      category_id: "food",
      note: "Groceries",
    });
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("rejects a payer outside the verified household", async () => {
    configureSupabase({ payer: null });

    await expect(transactionsModule.createTransaction(transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Choose a household member for this transaction.",
      fieldErrors: { paidBy: "Choose a household member." },
    });

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
  });

  it("sanitizes create database failures", async () => {
    configureSupabase({ transactionError: { message: "database details" } });

    await expect(transactionsModule.createTransaction(transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Unable to save the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("updates only account-free fields within the verified household", async () => {
    const { transactionEqHousehold, transactionEqId } = configureSupabase();

    await expect(transactionsModule.updateTransaction("transaction-id", transactionForm({ amount: "51", paidBy: "member-id", note: "Updated" }))).resolves.toEqual({ status: "success" });

    expect(mocks.update).toHaveBeenCalledWith({
      kind: "expense",
      amount: 51,
      occurred_on: "2026-07-14",
      paid_by: "member-id",
      category_id: "food",
      note: "Updated",
    });
    expect(transactionEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("sanitizes update database failures", async () => {
    configureSupabase({ transactionError: { message: "database details" } });

    await expect(transactionsModule.updateTransaction("transaction-id", transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Unable to update the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("scopes deletion to the verified household", async () => {
    const { transactionEqHousehold, transactionEqId } = configureSupabase();

    await expect(transactionsModule.deleteTransaction("transaction-id")).resolves.toEqual({ status: "success" });

    expect(transactionEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("sanitizes delete database failures", async () => {
    configureSupabase({ transactionError: { message: "database details" } });

    await expect(transactionsModule.deleteTransaction("transaction-id")).resolves.toEqual({
      status: "error",
      formError: "Unable to delete the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("rejects transfer submissions at the validation boundary", async () => {
    await expect(transactionsModule.createTransaction(transactionForm({ kind: "transfer" }))).resolves.toMatchObject({ status: "error" });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
