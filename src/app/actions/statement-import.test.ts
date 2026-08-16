import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  parseStatementFile: vi.fn(),
  revalidatePath: vi.fn(),
  transactionInsert: vi.fn(),
  duplicateHashLimit: vi.fn(),
  duplicateHashHouseholdEq: vi.fn(),
  duplicateHashEq: vi.fn(),
  cardMappingsEq: vi.fn(),
  getMerchantAutomationRules: vi.fn(),
  duplicateTransactionRows: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("@/lib/merchant-automations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/merchant-automations")>()),
  getMerchantAutomationRules: mocks.getMerchantAutomationRules,
}));
vi.mock("@/lib/statement-import", () => ({ parseStatementFile: mocks.parseStatementFile }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./statement-import");

const statementHash = "b111c6e1d318f203063e5c16bab43c108326af0aa2f7b65760c95547a43dbe52";

function statementFile(bytes: BlobPart[] = ["statement"]) {
  return new File(bytes, "statement.csv", { type: "text/csv" });
}

function formData(file: File) {
  const input = new FormData();
  input.set("statement", file);
  return input;
}

function parsedStatement() {
  return {
    rows: [
      {
        importRowNumber: 8,
        cardLastFour: "4548",
        merchant: "Corner Market",
        occurredOn: "2026-07-04",
        kind: "expense",
        amount: 12.34,
        note: "Fruit",
      },
      {
        importRowNumber: 9,
        cardLastFour: "9999",
        merchant: "Refund Shop",
        occurredOn: "2026-07-02",
        kind: "income",
        amount: 8.5,
        note: "",
      },
    ],
    skippedZeroCount: 1,
  };
}

describe("statement import action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      supabase: { from: mocks.from },
      householdId: "household-id",
      userId: "importer-id",
      role: "member",
    });
    mocks.duplicateHashLimit.mockResolvedValue({ data: [], error: null });
    mocks.cardMappingsEq.mockResolvedValue({ data: [{ last_four: "4548", user_id: "payer-id" }], error: null });
    mocks.transactionInsert.mockResolvedValue({ error: null });
    mocks.parseStatementFile.mockResolvedValue(parsedStatement());
    mocks.getMerchantAutomationRules.mockResolvedValue([]);
    mocks.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: vi.fn((columns: string) =>
            columns === "id" ? { eq: mocks.duplicateHashHouseholdEq } : { eq: mocks.duplicateTransactionRows },
          ),
          insert: mocks.transactionInsert,
        };
      }
      if (table === "member_cards") return { select: vi.fn().mockReturnValue({ eq: mocks.cardMappingsEq }) };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.duplicateHashHouseholdEq.mockReturnValue({ eq: mocks.duplicateHashEq });
    mocks.duplicateHashEq.mockReturnValue({ limit: mocks.duplicateHashLimit });
    mocks.duplicateTransactionRows.mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) });
  });

  it("imports mapped and unknown cards in one normalized unassigned-safe batch", async () => {
    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "success",
      data: {
        importedRowCount: "2",
        skippedZeroCount: "1",
        incomeTotal: "8.50",
        expenseTotal: "12.34",
        earliestOccurredOn: "2026-07-02",
        latestOccurredOn: "2026-07-04",
      },
    });

    expect(mocks.from).toHaveBeenCalledWith("member_cards");
    expect(mocks.duplicateHashHouseholdEq).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.duplicateHashEq).toHaveBeenCalledWith("import_file_hash", statementHash);
    expect(mocks.duplicateHashLimit).toHaveBeenCalledWith(1);
    expect(mocks.cardMappingsEq).toHaveBeenCalledWith("household_id", "household-id");
    expect(mocks.transactionInsert).toHaveBeenCalledTimes(1);
    expect(mocks.transactionInsert).toHaveBeenCalledWith([
      {
        household_id: "household-id",
        created_by: "importer-id",
        paid_by: "payer-id",
        source: "statement_import",
        subcategory_id: null,
        merchant: "Corner Market",
        note: "Fruit",
        occurred_on: "2026-07-04",
        kind: "expense",
        amount: 12.34,
        import_file_hash: statementHash,
        import_row_number: 8,
      },
      {
        household_id: "household-id",
        created_by: "importer-id",
        paid_by: null,
        source: "statement_import",
        subcategory_id: null,
        merchant: "Refund Shop",
        note: "",
        occurred_on: "2026-07-02",
        kind: "income",
        amount: 8.5,
        import_file_hash: statementHash,
        import_row_number: 9,
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets-goals");
  });

  it("returns a duplicate preview before inserting matching import rows", async () => {
    mocks.duplicateTransactionRows.mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ id: "existing", kind: "expense", amount: 12.34, occurred_on: "2026-07-04", merchant: "Corner Market" }],
        error: null,
      }),
    });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toMatchObject({
      status: "confirmation_required",
      duplicatePreview: expect.objectContaining({
        matches: [expect.objectContaining({ candidate: expect.objectContaining({ id: "8" }) })],
      }),
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("keeps existing import matches and inserts the remaining rows in one batch after confirmation", async () => {
    mocks.duplicateTransactionRows.mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ id: "existing", kind: "expense", amount: 12.34, occurred_on: "2026-07-04", merchant: "Corner Market" }],
        error: null,
      }),
    });
    const input = formData(statementFile());
    const preview = await actions.importStatement(null, input);
    if (preview.status !== "confirmation_required") throw new Error("Expected duplicate preview");
    input.set("duplicateFingerprint", preview.duplicatePreview.fingerprint);
    input.append("discardDuplicateId", "8");

    await expect(actions.importStatement(null, input)).resolves.toMatchObject({
      status: "success",
      data: { importedRowCount: "1", skippedDuplicateCount: "1" },
    });
    expect(mocks.transactionInsert).toHaveBeenCalledTimes(1);
    expect(mocks.transactionInsert).toHaveBeenCalledWith([expect.objectContaining({ import_row_number: 9 })]);
  });

  it("accepts a missing current-user card mapping and leaves matching rows unassigned", async () => {
    mocks.cardMappingsEq.mockResolvedValue({ data: [], error: null });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toMatchObject({ status: "success" });
    expect(mocks.transactionInsert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ paid_by: null })]));
  });

  it("requires confirmation before inserting rule-normalized imported rows", async () => {
    mocks.getMerchantAutomationRules.mockResolvedValue([
      { id: "normalize", action: "normalize_merchant", pattern: "corner", replacement: "Market", enabled: true, position: 0 },
      {
        id: "expense",
        action: "assign_category",
        pattern: "corner",
        subcategoryId: "groceries",
        destinationKind: "expense",
        enabled: true,
        position: 1,
      },
      {
        id: "income",
        action: "assign_category",
        pattern: "refund",
        categoryId: "income-other",
        destinationKind: "income",
        enabled: true,
        position: 2,
      },
    ]);

    const input = formData(statementFile());
    const preview = await actions.importStatement(null, input);

    expect(preview).toMatchObject({
      status: "automation_confirmation_required",
      automationPreview: expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({ expected_merchant: "Corner Market", merchant: "Market", subcategory_id: "groceries" }),
        ]),
      }),
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();

    if (preview.status !== "automation_confirmation_required") throw new Error("Expected automation preview");
    input.set("automationFingerprint", preview.automationPreview.fingerprint);
    await expect(actions.importStatement(null, input)).resolves.toMatchObject({ status: "success" });

    expect(mocks.transactionInsert).toHaveBeenCalledTimes(1);
    expect(mocks.transactionInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ merchant: "Market", subcategory_id: "groceries" }),
        expect.objectContaining({ merchant: "Refund Shop", category_id: "income-other", subcategory_id: null }),
      ]),
    );
  });

  it("defaults imported Bills assignments to each transaction month", async () => {
    mocks.getMerchantAutomationRules.mockResolvedValue([
      {
        id: "bills",
        action: "assign_category",
        pattern: "corner",
        subcategoryId: "electricity",
        destinationKind: "expense",
        destinationIsBills: true,
        enabled: true,
        position: 0,
      },
    ]);

    const input = formData(statementFile());
    const preview = await actions.importStatement(null, input);
    if (preview.status !== "automation_confirmation_required") throw new Error("Expected automation preview");
    input.set("automationFingerprint", preview.automationPreview.fingerprint);
    await expect(actions.importStatement(null, input)).resolves.toMatchObject({ status: "success" });

    expect(mocks.transactionInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          subcategory_id: "electricity",
          service_period_start: "2026-07-01",
          service_period_end: "2026-07-31",
        }),
      ]),
    );
  });

  it("rejects invalid parsed rows without inserting any transactions", async () => {
    mocks.parseStatementFile.mockRejectedValue(new Error("row 8: invalid date"));

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "Check row 8 and try again.",
      fieldErrors: { statement: "Check row 8 and try again." },
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("rejects oversized files before parsing or writing", async () => {
    await expect(actions.importStatement(null, formData(statementFile([new Uint8Array(1024 * 1024 + 1)])))).resolves.toEqual({
      status: "error",
      formError: "Choose a CSV or XLSX file up to 1 MB.",
      fieldErrors: { statement: "Choose a CSV or XLSX file up to 1 MB." },
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("rejects a previously imported file before parsing or inserting", async () => {
    mocks.duplicateHashLimit.mockResolvedValue({ data: [{ id: "existing" }], error: null });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "This file was already imported.",
      fieldErrors: { statement: "Choose a different file." },
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a duplicate-file lookup failure before parsing or inserting", async () => {
    mocks.duplicateHashLimit.mockResolvedValue({ data: null, error: { message: "database details" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "Unable to process this file. Try again.",
      fieldErrors: {},
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a card-mapping lookup failure without inserting a partial import", async () => {
    mocks.cardMappingsEq.mockResolvedValue({ data: null, error: { message: "database details" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "Unable to process this file. Try again.",
      fieldErrors: {},
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("does not insert any rows when rule loading fails", async () => {
    mocks.getMerchantAutomationRules.mockRejectedValue(new Error("database details"));

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "Unable to process this file. Try again.",
      fieldErrors: {},
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a failed atomic insert and does not report a digest", async () => {
    mocks.transactionInsert.mockResolvedValue({ error: { message: "duplicate key value reveals database detail" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error",
      formError: "Unable to process this file. Try again.",
      fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
