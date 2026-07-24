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
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
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
      { importRowNumber: 8, cardLastFour: "4548", merchant: "Corner Market", occurredOn: "2026-07-04", kind: "expense", amount: 12.34, note: "Fruit" },
      { importRowNumber: 9, cardLastFour: "9999", merchant: "Refund Shop", occurredOn: "2026-07-02", kind: "income", amount: 8.5, note: "" },
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
    mocks.from.mockImplementation((table: string) => {
      if (table === "transactions") {
        return {
          select: vi.fn().mockReturnValue({ eq: mocks.duplicateHashHouseholdEq }),
          insert: mocks.transactionInsert,
        };
      }
      if (table === "member_cards") return { select: vi.fn().mockReturnValue({ eq: mocks.cardMappingsEq }) };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.duplicateHashHouseholdEq.mockReturnValue({ eq: mocks.duplicateHashEq });
    mocks.duplicateHashEq.mockReturnValue({ limit: mocks.duplicateHashLimit });
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
        household_id: "household-id", created_by: "importer-id", paid_by: "payer-id", source: "statement_import", category_id: null,
        merchant: "Corner Market", note: "Fruit", occurred_on: "2026-07-04", kind: "expense", amount: 12.34,
        import_file_hash: statementHash, import_row_number: 8,
      },
      {
        household_id: "household-id", created_by: "importer-id", paid_by: null, source: "statement_import", category_id: null,
        merchant: "Refund Shop", note: "", occurred_on: "2026-07-02", kind: "income", amount: 8.5,
        import_file_hash: statementHash, import_row_number: 9,
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("accepts a missing current-user card mapping and leaves matching rows unassigned", async () => {
    mocks.cardMappingsEq.mockResolvedValue({ data: [], error: null });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toMatchObject({ status: "success" });
    expect(mocks.transactionInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ paid_by: null }),
    ]));
  });

  it("rejects invalid parsed rows without inserting any transactions", async () => {
    mocks.parseStatementFile.mockRejectedValue(new Error("row 8: invalid date"));

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error", formError: "Check row 8 and try again.", fieldErrors: { statement: "Check row 8 and try again." },
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("rejects oversized files before parsing or writing", async () => {
    await expect(actions.importStatement(null, formData(statementFile([new Uint8Array(1024 * 1024 + 1)])))).resolves.toEqual({
      status: "error", formError: "Choose a CSV or XLSX file up to 1 MB.", fieldErrors: { statement: "Choose a CSV or XLSX file up to 1 MB." },
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("rejects a previously imported file before parsing or inserting", async () => {
    mocks.duplicateHashLimit.mockResolvedValue({ data: [{ id: "existing" }], error: null });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error", formError: "This file was already imported.", fieldErrors: { statement: "Choose a different file." },
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a duplicate-file lookup failure before parsing or inserting", async () => {
    mocks.duplicateHashLimit.mockResolvedValue({ data: null, error: { message: "database details" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error", formError: "Unable to process this file. Try again.", fieldErrors: {},
    });
    expect(mocks.parseStatementFile).not.toHaveBeenCalled();
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a card-mapping lookup failure without inserting a partial import", async () => {
    mocks.cardMappingsEq.mockResolvedValue({ data: null, error: { message: "database details" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error", formError: "Unable to process this file. Try again.", fieldErrors: {},
    });
    expect(mocks.transactionInsert).not.toHaveBeenCalled();
  });

  it("sanitizes a failed atomic insert and does not report a digest", async () => {
    mocks.transactionInsert.mockResolvedValue({ error: { message: "duplicate key value reveals database detail" } });

    await expect(actions.importStatement(null, formData(statementFile()))).resolves.toEqual({
      status: "error", formError: "Unable to process this file. Try again.", fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
