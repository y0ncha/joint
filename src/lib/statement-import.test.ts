import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";

const headers = [
  "כרטיס",
  "בית עסק",
  "תאריך עסקה",
  "סכום העסקה",
  "מנפיק",
  "סוג העסקה",
  "פירוט",
  "תאריך החיוב",
  "סכום החיוב",
  "כרטיס הוצג במעמד העסקה?",
  "מטבע העסקה",
  "שער ההמרה",
  "תאריך שער המרה",
  "עמלת ההמרה",
  "מדד בסיס",
  "שם המועדון",
  "אחוז הנחה",
  "סכום הנחה",
] as const;

type ParsedStatement = {
  rows: Array<{
    importRowNumber: number;
    cardLastFour: string;
    merchant: string;
    occurredOn: string;
    kind: "income" | "expense";
    amount: number;
    note: string;
  }>;
  skippedZeroCount: number;
};

type ParseStatementFile = (input: {
  name: string;
  type: string;
  bytes: Uint8Array;
}) => Promise<ParsedStatement>;

const nonZeroRows = [
  ["ויזה 1111", "  Demo Market  ", "14/07/2026", "999.99", "demo", "עסקה", "  quoted, \"note\"  ", "20/07/2026", "12.34"],
  ["מאסטרקארד 2222", "Demo Refund", "15/07/2026", "3.00", "demo", "זיכוי", "", "20/07/2026", "-7.50"],
] as const;

const zeroRow = ["ויזה 1111", "Demo Zero", "16/07/2026", "8.00", "demo", "עסקה", "ignored", "20/07/2026", "0.00"] as const;

function statementRow(values: readonly string[]) {
  return [...values, ...Array(headers.length - values.length).fill("")];
}

function statementWorkbook(rows: readonly (readonly string[])[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("כרטיסי אשראי");

  for (let index = 0; index < 8; index += 1) worksheet.addRow([`Preamble ${index + 1}`]);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(statementRow(row)));
  worksheet.addRow(["Footer text that is not a transaction"]);

  return workbook;
}

async function xlsxFixture(rows = [...nonZeroRows, zeroRow]) {
  return new Uint8Array(await statementWorkbook(rows).xlsx.writeBuffer());
}

async function csvFixture(rows = [...nonZeroRows, zeroRow]) {
  const bytes = new Uint8Array(await statementWorkbook(rows).csv.writeBuffer());
  return new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
}

async function oneMiBXlsxFixture() {
  const bytes = await xlsxFixture();
  return new Uint8Array([...bytes, ...new Uint8Array(1_048_576 - bytes.length)]);
}

async function expectSanitizedRowError(input: Parameters<ParseStatementFile>[0], rawCells: string | readonly string[]) {
  const error = await parseStatementFile(input).then(
    () => new Error("expected parser rejection"),
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toMatch(/row 10/i);
  for (const rawCell of typeof rawCells === "string" ? [rawCells] : rawCells) {
    expect((error as Error).message).not.toContain(rawCell);
  }
}

let parseStatementFile: ParseStatementFile;

beforeEach(async () => {
  const parserPath = "./statement-import";
  const parser = await import(/* @vite-ignore */ parserPath).catch(() => null) as { parseStatementFile?: ParseStatementFile } | null;

  expect(parser, "statement parser module must exist").not.toBeNull();
  expect(parser?.parseStatementFile, "statement parser must export parseStatementFile").toBeTypeOf("function");

  parseStatementFile = parser!.parseStatementFile!;
});

describe("parseStatementFile", () => {
  it("normalizes the exact Hebrew XLSX export while ignoring preamble, footer, and transaction amount", async () => {
    const result = await parseStatementFile({
      name: "statement.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: await xlsxFixture(),
    });

    expect(result).toEqual({
      rows: [
        {
          importRowNumber: 10,
          cardLastFour: "1111",
          merchant: "Demo Market",
          occurredOn: "2026-07-14",
          kind: "expense",
          amount: 12.34,
          note: "quoted, \"note\"",
        },
        {
          importRowNumber: 11,
          cardLastFour: "2222",
          merchant: "Demo Refund",
          occurredOn: "2026-07-15",
          kind: "income",
          amount: 7.5,
          note: "",
        },
      ],
      skippedZeroCount: 1,
    });
  });

  it("parses a UTF-8 BOM CSV with quoted text using the same exact header contract", async () => {
    const result = await parseStatementFile({ name: "statement.csv", type: "text/csv", bytes: await csvFixture() });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ importRowNumber: 10, note: "quoted, \"note\"", amount: 12.34 });
    expect(result.skippedZeroCount).toBe(1);
  });

  it("accepts the 1 MiB and 1,000-row limits, while rejecting unsupported, encrypted, malformed, oversized, and empty statements", async () => {
    await expect(parseStatementFile({ name: "boundary.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await oneMiBXlsxFixture() })).resolves.toMatchObject({ rows: expect.any(Array) });
    await expect(parseStatementFile({ name: "boundary.csv", type: "text/csv", bytes: await csvFixture(Array.from({ length: 1_000 }, () => nonZeroRows[0])) })).resolves.toMatchObject({ rows: expect.arrayContaining([expect.any(Object)]) });
    await expect(parseStatementFile({ name: "statement.xls", type: "application/vnd.ms-excel", bytes: await xlsxFixture() })).rejects.toThrow();
    await expect(parseStatementFile({ name: "statement.xlsm", type: "application/vnd.ms-excel.sheet.macroEnabled.12", bytes: await xlsxFixture() })).rejects.toThrow();
    await expect(parseStatementFile({ name: "password-protected.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "spoofed.csv", type: "text/csv", bytes: await xlsxFixture() })).rejects.toThrow();
    await expect(parseStatementFile({ name: "unsupported.csv", type: "text/csv", bytes: new Uint8Array([0xff, 0xfe, 0x00, 0x00]) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "statement.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(1_048_577) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "statement.csv", type: "text/csv", bytes: await csvFixture(Array.from({ length: 1_001 }, () => nonZeroRows[0])) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "statement.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([zeroRow]) })).rejects.toThrow();
  });

  it("permits extra columns but rejects missing or duplicate headers and invalid non-zero rows without exposing cells", async () => {
    const missingHeader = statementWorkbook(nonZeroRows);
    missingHeader.getWorksheet("כרטיסי אשראי")!.getRow(9).getCell(9).value = "סכום לא נכון";
    const duplicateHeader = statementWorkbook(nonZeroRows);
    duplicateHeader.getWorksheet("כרטיסי אשראי")!.insertRow(2, headers);
    const extraColumn = statementWorkbook(nonZeroRows);
    extraColumn.getWorksheet("כרטיסי אשראי")!.getRow(9).getCell(19).value = "עמודה נוספת";
    extraColumn.getWorksheet("כרטיסי אשראי")!.getRow(10).getCell(19).value = "ignored";

    await expect(parseStatementFile({ name: "missing.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(await missingHeader.xlsx.writeBuffer()) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "duplicate.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(await duplicateHeader.xlsx.writeBuffer()) })).rejects.toThrow();
    await expect(parseStatementFile({ name: "extra.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array(await extraColumn.xlsx.writeBuffer()) })).resolves.toMatchObject({ rows: expect.any(Array) });

    const unrelatedRawCell = "non-offending-raw-cell-sentinel";
    await expectSanitizedRowError({ name: "date.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 2), "31/02/2026", ...nonZeroRows[0].slice(3, 6), unrelatedRawCell, ...nonZeroRows[0].slice(7)]]) }, ["31/02/2026", unrelatedRawCell]);
    await expectSanitizedRowError({ name: "date-shape.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 2), "2026-07-14", ...nonZeroRows[0].slice(3)]]) }, "2026-07-14");
    await expectSanitizedRowError({ name: "date-padding.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 2), "1/7/2026", ...nonZeroRows[0].slice(3)]]) }, "1/7/2026");
    await expectSanitizedRowError({ name: "amount.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 8), "12.345"]]) }, "12.345");
    await expectSanitizedRowError({ name: "merchant.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[nonZeroRows[0][0], "   ", ...nonZeroRows[0].slice(2)]]) }, "   ");
    await expectSanitizedRowError({ name: "long-merchant.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[nonZeroRows[0][0], "x".repeat(201), ...nonZeroRows[0].slice(2)]]) }, "x".repeat(201));
    await expectSanitizedRowError({ name: "long-note.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 6), "n".repeat(501), ...nonZeroRows[0].slice(7)]]) }, "n".repeat(501));
  });
});
