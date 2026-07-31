import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
  transactionIn: vi.fn(),
  revalidatePath: vi.fn(),
  select: vi.fn(),
  subcategorySelect: vi.fn(),
}));

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
    subcategoryId: "groceries",
    paidBy: "partner-id",
    note: "Groceries",
    ...overrides,
  });
}

function configureContextClient({
  payer = { user_id: "partner-id" },
  transactionError = null,
  existingTransaction = { source: "manual" },
  subcategory = { categories: { system_key: null } },
}: {
  payer?: { user_id: string } | null;
  transactionError?: unknown;
  existingTransaction?: { source: "manual" | "statement_import" } | null;
  subcategory?: { categories: { system_key: string | null } } | null;
} = {}) {
  const payerMaybeSingle = vi.fn().mockResolvedValue({ data: payer, error: null });
  const payerEqUser = vi.fn().mockReturnValue({ maybeSingle: payerMaybeSingle });
  const payerEqHousehold = vi.fn().mockReturnValue({ eq: payerEqUser });
  const payerSelect = vi.fn().mockReturnValue({ eq: payerEqHousehold });
  const transactionEqHousehold = vi.fn().mockResolvedValue({ error: transactionError });
  const transactionEqId = vi.fn().mockReturnValue({ eq: transactionEqHousehold });
  const transactionIn = vi.fn().mockReturnValue({ eq: transactionEqHousehold });
  const sourceMaybeSingle = vi.fn().mockResolvedValue({ data: existingTransaction, error: null });
  const sourceEqHousehold = vi.fn().mockReturnValue({ maybeSingle: sourceMaybeSingle });
  const sourceEqId = vi.fn().mockReturnValue({ eq: sourceEqHousehold });
  const subcategoryMaybeSingle = vi.fn().mockResolvedValue({ data: subcategory, error: null });
  const subcategoryEqHousehold = vi.fn().mockReturnValue({ maybeSingle: subcategoryMaybeSingle });
  const subcategoryEqId = vi.fn().mockReturnValue({ eq: subcategoryEqHousehold });

  mocks.insert.mockResolvedValue({ error: transactionError });
  mocks.update.mockReturnValue({ eq: transactionEqId });
  mocks.delete.mockReturnValue({ eq: transactionEqId, in: transactionIn });
  mocks.from.mockImplementation((table: string) => {
    if (table === "household_members") return { select: payerSelect };
    if (table === "transactions") return { insert: mocks.insert, update: mocks.update, delete: mocks.delete, select: mocks.select };
    if (table === "subcategories") return { select: mocks.subcategorySelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  mocks.select.mockReturnValue({ eq: sourceEqId });
  mocks.subcategorySelect.mockReturnValue({ eq: subcategoryEqId });

  return {
    payerEqHousehold,
    sourceEqHousehold,
    sourceEqId,
    subcategoryEqHousehold,
    subcategoryEqId,
    transactionEqHousehold,
    transactionEqId,
    transactionIn,
  };
}

describe("transaction actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      supabase: { from: mocks.from },
      userId: "member-id",
      householdId: "household-id",
      role: "member",
    });
  });

  it("creates an account-free transaction through verified request membership", async () => {
    const { payerEqHousehold } = configureContextClient();

    await expect(transactionsModule.createTransaction(transactionForm({ householdId: "other-household" }))).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).toHaveBeenCalledWith("household_members");
    expect(mocks.insert).toHaveBeenCalledWith({
      household_id: "household-id",
      created_by: "member-id",
      paid_by: "partner-id",
      kind: "expense",
      amount: 50,
      occurred_on: "2026-07-14",
      subcategory_id: "groceries",
      note: "Groceries",
      service_period_start: null,
      service_period_end: null,
    });
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
    expect(payerEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it.each(["", undefined])("requires a subcategory for manual creates when it is %s", async (subcategoryId) => {
    configureContextClient();
    const input = transactionForm();
    if (subcategoryId === undefined) input.delete("subcategoryId");
    else input.set("subcategoryId", subcategoryId);

    await expect(transactionsModule.createTransaction(input)).resolves.toMatchObject({
      status: "error",
      fieldErrors: { subcategoryId: "Select a value." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a manual transaction without payer attribution", async () => {
    configureContextClient();

    await expect(transactionsModule.createTransaction(transactionForm({ paidBy: "" }))).resolves.toEqual({ status: "success" });

    expect(mocks.from).not.toHaveBeenCalledWith("household_members");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ paid_by: null, subcategory_id: "groceries" }));
  });

  it("persists the inclusive billing period only for a verified Bills subcategory", async () => {
    const { subcategoryEqHousehold, subcategoryEqId } = configureContextClient({ subcategory: { categories: { system_key: "bills" } } });

    await expect(
      transactionsModule.createTransaction(transactionForm({ servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-31" })),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.subcategorySelect).toHaveBeenCalledWith("category_id, categories!inner(system_key)");
    expect(subcategoryEqId).toHaveBeenCalledWith("id", "groceries");
    expect(subcategoryEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ service_period_start: "2026-07-01", service_period_end: "2026-07-31" }),
    );
  });

  it("clears forged billing periods for a non-Bills transaction", async () => {
    configureContextClient();

    await expect(
      transactionsModule.createTransaction(transactionForm({ servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-31" })),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ service_period_start: null, service_period_end: null, occurred_on: "2026-07-14", amount: 50 }),
    );
  });

  it("rejects a payer outside the verified household", async () => {
    configureContextClient({ payer: null });

    await expect(transactionsModule.createTransaction(transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Choose a household member for this transaction.",
      fieldErrors: { paidBy: "Choose a household member." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
  });

  it("sanitizes create database failures", async () => {
    configureContextClient({ transactionError: { message: "database details" } });

    await expect(transactionsModule.createTransaction(transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Unable to save the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("updates only account-free fields within the verified household", async () => {
    const { payerEqHousehold, transactionEqHousehold, transactionEqId } = configureContextClient();

    await expect(
      transactionsModule.updateTransaction("transaction-id", transactionForm({ amount: "51", paidBy: "member-id", note: "Updated" })),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.update).toHaveBeenCalledWith({
      kind: "expense",
      amount: 51,
      occurred_on: "2026-07-14",
      paid_by: "member-id",
      subcategory_id: "groceries",
      note: "Updated",
      service_period_start: null,
      service_period_end: null,
    });
    expect(transactionEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(payerEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.from).not.toHaveBeenCalledWith("accounts");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("keeps imported transactions uncategorized and unassigned when editing", async () => {
    const { sourceEqHousehold, sourceEqId, transactionEqHousehold, transactionEqId } = configureContextClient({
      existingTransaction: { source: "statement_import" },
    });

    await expect(
      transactionsModule.updateTransaction("transaction-id", transactionForm({ subcategoryId: "", paidBy: "" })),
    ).resolves.toEqual({
      status: "success",
    });

    expect(mocks.from).not.toHaveBeenCalledWith("household_members");
    expect(mocks.select).toHaveBeenCalledWith("source");
    expect(sourceEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(sourceEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ subcategory_id: null, paid_by: null }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ source: expect.anything() }));
    expect(transactionEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
  });

  it.each(["", undefined])("rejects a %s subcategory when updating a stored manual transaction", async (subcategoryId) => {
    const { sourceEqHousehold, sourceEqId } = configureContextClient({ existingTransaction: { source: "manual" } });
    const input = transactionForm({ paidBy: "member-id" });
    if (subcategoryId === undefined) input.delete("subcategoryId");
    else input.set("subcategoryId", subcategoryId);

    await expect(transactionsModule.updateTransaction("transaction-id", input)).resolves.toMatchObject({
      status: "error",
      fieldErrors: { subcategoryId: "Select a value." },
    });

    expect(mocks.select).toHaveBeenCalledWith("source");
    expect(sourceEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(sourceEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sanitizes update database failures", async () => {
    configureContextClient({ transactionError: { message: "database details" } });

    await expect(transactionsModule.updateTransaction("transaction-id", transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Unable to update the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("scopes deletion to the verified household", async () => {
    const { transactionEqHousehold, transactionEqId } = configureContextClient();

    await expect(transactionsModule.deleteTransaction("transaction-id")).resolves.toEqual({ status: "success" });

    expect(transactionEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("sanitizes delete database failures", async () => {
    configureContextClient({ transactionError: { message: "database details" } });

    await expect(transactionsModule.deleteTransaction("transaction-id")).resolves.toEqual({
      status: "error",
      formError: "Unable to delete the transaction. Please try again.",
      fieldErrors: {},
    });
  });

  it("bulk deletes only selected transactions in the verified household", async () => {
    const { transactionEqHousehold, transactionIn } = configureContextClient();

    await expect(transactionsModule.deleteTransactions(["transaction-a", "transaction-b"])).resolves.toEqual({ status: "success" });

    expect(transactionIn).toHaveBeenCalledWith("id", ["transaction-a", "transaction-b"]);
    expect(transactionEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("rejects transfer submissions at the validation boundary", async () => {
    await expect(transactionsModule.createTransaction(transactionForm({ kind: "transfer" }))).resolves.toMatchObject({ status: "error" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
