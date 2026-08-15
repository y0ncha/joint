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
  duplicateTransactions: vi.fn(),
  subcategorySelect: vi.fn(),
  getMerchantAutomationRules: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("@/lib/merchant-automations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/merchant-automations")>()),
  getMerchantAutomationRules: mocks.getMerchantAutomationRules,
}));
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
  duplicates = [] as Array<{
    id: string;
    kind: "income" | "expense";
    amount: number;
    occurred_on: string;
    merchant: string;
    recurring_schedule_id?: string | null;
  }>,
  payer = { user_id: "partner-id" },
  transactionError = null,
  existingTransaction = { source: "manual" },
  subcategory = { categories: { system_key: null } },
}: {
  duplicates?: Array<{
    id: string;
    kind: "income" | "expense";
    amount: number;
    occurred_on: string;
    merchant: string;
    recurring_schedule_id?: string | null;
  }>;
  payer?: { user_id: string } | null;
  transactionError?: unknown;
  existingTransaction?: { source: "manual" | "statement_import"; recurring_schedule_id?: string | null } | null;
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
  const duplicateHouseholdEq = vi.fn().mockReturnValue({ in: mocks.duplicateTransactions });
  const subcategoryMaybeSingle = vi.fn().mockResolvedValue({ data: subcategory, error: null });
  const subcategoryEqHousehold = vi.fn().mockReturnValue({ maybeSingle: subcategoryMaybeSingle });
  const subcategoryEqId = vi.fn().mockReturnValue({ eq: subcategoryEqHousehold });

  mocks.insert.mockResolvedValue({ error: transactionError });
  mocks.update.mockReturnValue({ eq: transactionEqId });
  mocks.delete.mockReturnValue({ eq: transactionEqId, in: transactionIn });
  mocks.duplicateTransactions.mockResolvedValue({ data: duplicates, error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "household_members") return { select: payerSelect };
    if (table === "transactions") return { insert: mocks.insert, update: mocks.update, delete: mocks.delete, select: mocks.select };
    if (table === "subcategories") return { select: mocks.subcategorySelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  mocks.select.mockImplementation((columns: string) => (columns.startsWith("source") ? { eq: sourceEqId } : { eq: duplicateHouseholdEq }));
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
    duplicateHouseholdEq,
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
    mocks.getMerchantAutomationRules.mockResolvedValue([]);
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      supabase: { from: mocks.from, rpc: mocks.rpc },
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
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets-goals");
  });

  it("creates a schedule atomically when recurrence is configured", async () => {
    configureContextClient();

    await expect(
      transactionsModule.createTransaction(transactionForm({ recurrenceCadence: "monthly", recurrenceInterval: "1" })),
    ).resolves.toEqual({
      status: "success",
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_recurring_transaction_schedule",
      expect.objectContaining({ target_cadence: "monthly", target_interval_count: 1, target_occurred_on: "2026-07-14" }),
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns a duplicate preview before inserting a matching manual transaction", async () => {
    configureContextClient({
      duplicates: [{ id: "existing", kind: "expense", amount: 50, occurred_on: "2026-07-14", merchant: " groceries " }],
    });

    await expect(transactionsModule.createTransaction(transactionForm({ merchant: "Groceries" }))).resolves.toMatchObject({
      status: "confirmation_required",
      duplicatePreview: expect.objectContaining({
        matches: [expect.objectContaining({ existing: expect.objectContaining({ id: "existing" }) })],
      }),
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keeps the existing manual match after confirming its preview", async () => {
    configureContextClient({
      duplicates: [{ id: "existing", kind: "expense", amount: 50, occurred_on: "2026-07-14", merchant: "Groceries" }],
    });
    const input = transactionForm({ merchant: "Groceries" });
    const preview = await transactionsModule.createTransaction(input);
    if (preview.status !== "confirmation_required") throw new Error("Expected duplicate preview");
    input.set("duplicateFingerprint", preview.duplicatePreview.fingerprint);
    input.append("discardDuplicateId", "manual");

    await expect(transactionsModule.createTransaction(input)).resolves.toEqual({ status: "success", data: { skippedDuplicateCount: "1" } });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates future schedule occurrences after confirming a duplicate recurring first entry", async () => {
    configureContextClient({
      duplicates: [{ id: "existing", kind: "expense", amount: 50, occurred_on: "2026-07-14", merchant: "Groceries" }],
    });
    const input = transactionForm({ merchant: "Groceries", recurrenceCadence: "monthly", recurrenceInterval: "1" });
    const preview = await transactionsModule.createTransaction(input);
    if (preview.status !== "confirmation_required") throw new Error("Expected duplicate preview");
    input.set("duplicateFingerprint", preview.duplicatePreview.fingerprint);
    input.append("discardDuplicateId", "manual");

    await expect(transactionsModule.createTransaction(input)).resolves.toEqual({ status: "success", data: { skippedDuplicateCount: "1" } });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_recurring_transaction_schedule_after_duplicate",
      expect.objectContaining({
        target_cadence: "monthly",
        target_existing_transaction_id: "existing",
        target_interval_count: 1,
        target_occurred_on: "2026-07-14",
      }),
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not create a second schedule when the confirmed duplicate already belongs to one", async () => {
    configureContextClient({
      duplicates: [
        {
          id: "existing",
          kind: "expense",
          amount: 50,
          occurred_on: "2026-07-14",
          merchant: "Groceries",
          recurring_schedule_id: "schedule-id",
        },
      ],
    });
    const input = transactionForm({ merchant: "Groceries", recurrenceCadence: "monthly", recurrenceInterval: "1" });
    const preview = await transactionsModule.createTransaction(input);
    if (preview.status !== "confirmation_required") throw new Error("Expected duplicate preview");
    input.set("duplicateFingerprint", preview.duplicatePreview.fingerprint);
    input.append("discardDuplicateId", "manual");

    await expect(transactionsModule.createTransaction(input)).resolves.toEqual({ status: "success", data: { skippedDuplicateCount: "1" } });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale manual duplicate preview", async () => {
    configureContextClient({
      duplicates: [{ id: "existing", kind: "expense", amount: 50, occurred_on: "2026-07-14", merchant: "Groceries" }],
    });

    await expect(
      transactionsModule.createTransaction(transactionForm({ merchant: "Groceries", duplicateFingerprint: "stale" })),
    ).resolves.toMatchObject({
      status: "error",
      formError: expect.stringContaining("stale"),
    });
    expect(mocks.insert).not.toHaveBeenCalled();
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

  it("normalizes and automatically assigns a blank manual destination", async () => {
    configureContextClient();
    mocks.getMerchantAutomationRules.mockResolvedValue([
      { id: "normalize", action: "normalize_merchant", pattern: "corner", replacement: "Corner Market", enabled: true, position: 0 },
      {
        id: "assign",
        action: "assign_category",
        pattern: "corner",
        subcategoryId: "groceries",
        destinationKind: "expense",
        enabled: true,
        position: 1,
      },
    ]);

    await expect(transactionsModule.createTransaction(transactionForm({ subcategoryId: "", merchant: "Corner shop" }))).resolves.toEqual({
      status: "success",
    });

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ merchant: "Corner Market", subcategory_id: "groceries" }));
  });

  it("defaults an automated Bills assignment to the transaction month", async () => {
    configureContextClient({ subcategory: { categories: { system_key: "bills" } } });
    mocks.getMerchantAutomationRules.mockResolvedValue([
      {
        id: "assign-bills",
        action: "assign_category",
        pattern: "power",
        subcategoryId: "electricity",
        destinationKind: "expense",
        destinationIsBills: true,
        enabled: true,
        position: 0,
      },
    ]);

    await expect(transactionsModule.createTransaction(transactionForm({ subcategoryId: "", merchant: "Power company" }))).resolves.toEqual({
      status: "success",
    });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subcategory_id: "electricity",
        service_period_start: "2026-07-01",
        service_period_end: "2026-07-31",
      }),
    );
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

  it("requires a billing period for a verified Bills subcategory", async () => {
    configureContextClient({ subcategory: { categories: { system_key: "bills" } } });

    await expect(transactionsModule.createTransaction(transactionForm())).resolves.toEqual({
      status: "error",
      formError: "Check the form details.",
      fieldErrors: { servicePeriodEnd: "Choose a billing period." },
    });

    expect(mocks.insert).not.toHaveBeenCalled();
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
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets-goals");
  });

  it("applies recurring future edits through the atomic schedule RPC", async () => {
    configureContextClient({ existingTransaction: { source: "manual", recurring_schedule_id: "schedule-id" } });

    await expect(
      transactionsModule.updateTransaction(
        "transaction-id",
        transactionForm({ recurrenceScope: "future", amount: "51", paidBy: "member-id" }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.rpc).toHaveBeenCalledWith("update_recurring_transaction_occurrence", {
      target_amount: 51,
      target_category_id: null,
      target_merchant: "",
      target_note: "Groceries",
      target_paid_by: "member-id",
      target_scope: "future",
      target_service_period_end: null,
      target_service_period_start: null,
      target_subcategory_id: "groceries",
      target_transaction_id: "transaction-id",
    });
    expect(mocks.update).not.toHaveBeenCalled();
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
    expect(mocks.select).toHaveBeenCalledWith("source, recurring_schedule_id");
    expect(sourceEqId).toHaveBeenCalledWith("id", "transaction-id");
    expect(sourceEqHousehold).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ subcategory_id: null, paid_by: null }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ source: expect.anything() }));
    expect(mocks.getMerchantAutomationRules).not.toHaveBeenCalled();
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

    expect(mocks.select).toHaveBeenCalledWith("source, recurring_schedule_id");
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
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets-goals");
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
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(5);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets-goals");
  });

  it("rejects transfer submissions at the validation boundary", async () => {
    await expect(transactionsModule.createTransaction(transactionForm({ kind: "transfer" }))).resolves.toMatchObject({ status: "error" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
