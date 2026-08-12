import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

type ParseStatementFile = (input: { name: string; type: string; bytes: Uint8Array }) => Promise<ParsedStatement>;

const nonZeroRows = [
  ["ויזה 1111", "  Demo Market  ", "14/07/2026", "999.99", "demo", "עסקה", '  quoted, "note"  ', "20/07/2026", "12.34"],
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

async function xlsxFixture(rows: readonly (readonly string[])[] = [...nonZeroRows, zeroRow]) {
  return new Uint8Array(await statementWorkbook(rows).xlsx.writeBuffer());
}

type WorksheetXmlMutation = (xml: string) => string;

async function mutatedWorksheetXlsx(mutate: WorksheetXmlMutation) {
  const zip = await JSZip.loadAsync(await xlsxFixture());
  const worksheet = zip.file("xl/worksheets/sheet1.xml");
  if (!worksheet) throw new Error("worksheet fixture missing");
  const original = await worksheet.async("string");
  const mutated = mutate(original);
  if (mutated === original) throw new Error("worksheet mutation did not apply");
  zip.file("xl/worksheets/sheet1.xml", mutated);
  return new Uint8Array(await zip.generateAsync({ compression: "DEFLATE", type: "uint8array" }));
}

async function leadingSlashWorksheetXlsx(mutate: WorksheetXmlMutation) {
  const zip = await JSZip.loadAsync(await xlsxFixture());
  const worksheet = zip.file("xl/worksheets/sheet1.xml");
  if (!worksheet) throw new Error("worksheet fixture missing");
  const original = await worksheet.async("string");
  const mutated = mutate(original);
  if (mutated === original) throw new Error("worksheet mutation did not apply");
  zip.remove("xl/worksheets/sheet1.xml");
  zip.file("/xl/worksheets/sheet1.xml", mutated);
  return new Uint8Array(await zip.generateAsync({ compression: "DEFLATE", type: "uint8array" }));
}

async function mutatedXlsxEntry(entryName: string, mutate: WorksheetXmlMutation) {
  const zip = await JSZip.loadAsync(await xlsxFixture());
  const entry = zip.file(entryName);
  if (!entry) throw new Error(`${entryName} fixture missing`);
  const original = await entry.async("string");
  const mutated = mutate(original);
  if (mutated === original) throw new Error("ZIP entry mutation did not apply");
  zip.file(entryName, mutated);
  return new Uint8Array(await zip.generateAsync({ compression: "DEFLATE", type: "uint8array" }));
}

async function csvFixture(rows: readonly (readonly string[])[] = [...nonZeroRows, zeroRow]) {
  const bytes = new Uint8Array(await statementWorkbook(rows).csv.writeBuffer());
  return new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
}

function readU32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeU16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function lastZipSignature(bytes: Uint8Array, signature: readonly number[]) {
  for (let offset = bytes.length - signature.length; offset >= 0; offset -= 1) {
    if (signature.every((value, index) => bytes[offset + index] === value)) return offset;
  }
  throw new Error("fixture ZIP signature missing");
}

type ZipMutation = (bytes: Uint8Array, eocdOffset: number, centralDirectoryOffset: number) => void;

async function mutatedXlsx(mutate: ZipMutation) {
  const bytes = await xlsxFixture();
  const eocdOffset = lastZipSignature(bytes, [0x50, 0x4b, 0x05, 0x06]);
  const centralDirectoryOffset = readU32(bytes, eocdOffset + 16);
  const mutated = bytes.slice();
  mutate(mutated, eocdOffset, centralDirectoryOffset);
  return mutated;
}

const maliciousZipMutations: Array<[string, ZipMutation]> = [
  ["central-directory bounds", (bytes, eocdOffset) => writeU32(bytes, eocdOffset + 16, bytes.length)],
  ["uncompressed entry size", (bytes, _eocdOffset, centralDirectoryOffset) => writeU32(bytes, centralDirectoryOffset + 24, 0xffffffff)],
  ["central-directory entry count", (bytes, eocdOffset) => writeU16(bytes, eocdOffset + 10, 0xffff)],
  [
    "compression ratio",
    (bytes, _eocdOffset, centralDirectoryOffset) =>
      writeU32(bytes, centralDirectoryOffset + 24, readU32(bytes, centralDirectoryOffset + 20) * 101),
  ],
];

const sparseWorksheetMutations: Array<[string, WorksheetXmlMutation]> = [
  ["row index", (xml) => xml.replace('<row r="10"', '<row r="4294967295"')],
  ["cell column", (xml) => xml.replace('<c r="A10"', '<c r="XFD10"')],
];

const hugeMergeRangeMutation: WorksheetXmlMutation = (xml) =>
  xml.replace("</worksheet>", '<mergeCells count="1"><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>');
const boundedMergeRangeMutation: WorksheetXmlMutation = (xml) =>
  xml.replace("</worksheet>", '<mergeCells count="1"><mergeCell ref="A1:B2"/></mergeCells></worksheet>');
const tooManyMergeRangesMutation: WorksheetXmlMutation = (xml) =>
  xml.replace(
    "</worksheet>",
    `<mergeCells count="65">${Array.from({ length: 65 }, (_, index) => `<mergeCell ref="A${index + 1}:A${index + 1}"/>`).join("")}</mergeCells></worksheet>`,
  );
const tooManyWorksheetRowsMutation: WorksheetXmlMutation = (xml) =>
  xml.replace("</sheetData>", `${Array.from({ length: 1_101 }, (_, index) => `<row r="1" ht="${index + 1}.1"/>`).join("")}</sheetData>`);
const tooManyWorksheetCellsMutation: WorksheetXmlMutation = (xml) =>
  xml.replace(
    "</sheetData>",
    `<row r="1">${Array.from({ length: 70_401 }, (_, index) => `<c r="A${(index % 64) + 1}" t="n"><v>${index}</v></c>`).join("")}</row></sheetData>`,
  );
const tooManySharedStringsMutation: WorksheetXmlMutation = (xml) =>
  xml.replace("</sst>", `${Array.from({ length: 70_401 }, (_, index) => `<si><t>shared-${index}</t></si>`).join("")}</sst>`);
const tooManyStylesMutation: WorksheetXmlMutation = (xml) =>
  xml.replace("</cellXfs>", `${Array.from({ length: 1_025 }, () => "<xf/>").join("")}</cellXfs>`);

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
  const parser = (await import(/* @vite-ignore */ parserPath).catch(() => null)) as { parseStatementFile?: ParseStatementFile } | null;

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
          note: 'quoted, "note"',
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

  it.each(maliciousZipMutations)("rejects XLSX with malicious %s before ExcelJS loads it", async (_label, mutate) => {
    const bytes = await mutatedXlsx(mutate);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: "malicious.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it.each(sparseWorksheetMutations)("rejects XLSX with sparse %s coordinates before worksheet scans", async (_label, mutate) => {
    const bytes = await mutatedWorksheetXlsx(mutate);

    await expect(
      parseStatementFile({
        name: "sparse.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes,
      }),
    ).rejects.toThrow("Invalid statement file.");
  });

  it("rejects XLSX with a huge merge range before ExcelJS loads it", async () => {
    const bytes = await mutatedWorksheetXlsx(hugeMergeRangeMutation);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: "huge-merge.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it("rejects a leading-slash worksheet path with a huge merge range before ExcelJS loads it", async () => {
    const bytes = await leadingSlashWorksheetXlsx(hugeMergeRangeMutation);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: "leading-slash-merge.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it("accepts an XLSX with a bounded merge range", async () => {
    await expect(
      parseStatementFile({
        name: "bounded-merge.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await mutatedWorksheetXlsx(boundedMergeRangeMutation),
      }),
    ).resolves.toMatchObject({ rows: expect.any(Array) });
  });

  it("rejects a CSV with more than the bounded worksheet row count", async () => {
    const rows = [...nonZeroRows, ...Array.from({ length: 1_101 }, () => [] as string[])];

    await expect(parseStatementFile({ name: "too-many-rows.csv", type: "text/csv", bytes: await csvFixture(rows) })).rejects.toThrow(
      "Invalid statement file.",
    );
  });

  it("rejects a CSV row with more than the bounded column count before ExcelJS loads it", async () => {
    const bytes = new TextEncoder().encode(`${headers.join(",")}\n${Array.from({ length: 65 }, () => "value").join(",")}\n`);
    const csvGetter = vi.spyOn(ExcelJS.Workbook.prototype, "csv", "get");

    try {
      await expect(parseStatementFile({ name: "too-many-columns.csv", type: "text/csv", bytes })).rejects.toThrow(
        "Invalid statement file.",
      );
      expect(csvGetter).not.toHaveBeenCalled();
    } finally {
      csvGetter.mockRestore();
    }
  });

  it("rejects XLSX with too many merge ranges before ExcelJS loads it", async () => {
    const bytes = await mutatedWorksheetXlsx(tooManyMergeRangesMutation);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: "too-many-merges.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it.each([
    ["duplicate row elements", tooManyWorksheetRowsMutation],
    ["duplicate cell elements", tooManyWorksheetCellsMutation],
  ] as const)("rejects XLSX with %s before ExcelJS loads it", async (_label, mutate) => {
    const bytes = await mutatedWorksheetXlsx(mutate);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: "too-many-worksheet-elements.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it.each([
    ["shared strings", "xl/sharedStrings.xml", tooManySharedStringsMutation],
    ["styles", "xl/styles.xml", tooManyStylesMutation],
  ] as const)("rejects XLSX with too many %s elements before ExcelJS loads it", async (_label, entryName, mutate) => {
    const bytes = await mutatedXlsxEntry(entryName, mutate);
    const xlsxGetter = vi.spyOn(ExcelJS.Workbook.prototype, "xlsx", "get");

    try {
      await expect(
        parseStatementFile({
          name: `too-many-${_label}.xlsx`,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          bytes,
        }),
      ).rejects.toThrow("Invalid statement file.");
      expect(xlsxGetter).not.toHaveBeenCalled();
    } finally {
      xlsxGetter.mockRestore();
    }
  });

  it("parses a UTF-8 BOM CSV with quoted text using the same exact header contract", async () => {
    const result = await parseStatementFile({ name: "statement.csv", type: "text/csv", bytes: await csvFixture() });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ importRowNumber: 10, note: 'quoted, "note"', amount: 12.34 });
    expect(result.skippedZeroCount).toBe(1);
  });

  it("accepts the 1 MiB and 1,000-row limits, while rejecting unsupported, encrypted, malformed, oversized, and empty statements", async () => {
    await expect(
      parseStatementFile({
        name: "boundary.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await oneMiBXlsxFixture(),
      }),
    ).resolves.toMatchObject({ rows: expect.any(Array) });
    await expect(
      parseStatementFile({
        name: "boundary.csv",
        type: "text/csv",
        bytes: await csvFixture(Array.from({ length: 1_000 }, () => nonZeroRows[0])),
      }),
    ).resolves.toMatchObject({ rows: expect.arrayContaining([expect.any(Object)]) });
    await expect(
      parseStatementFile({ name: "statement.xls", type: "application/vnd.ms-excel", bytes: await xlsxFixture() }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({ name: "statement.xlsm", type: "application/vnd.ms-excel.sheet.macroEnabled.12", bytes: await xlsxFixture() }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "password-protected.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      }),
    ).rejects.toThrow();
    await expect(parseStatementFile({ name: "spoofed.csv", type: "text/csv", bytes: await xlsxFixture() })).rejects.toThrow();
    await expect(
      parseStatementFile({ name: "unsupported.csv", type: "text/csv", bytes: new Uint8Array([0xff, 0xfe, 0x00, 0x00]) }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "statement.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array(1_048_577),
      }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "statement.csv",
        type: "text/csv",
        bytes: await csvFixture(Array.from({ length: 1_001 }, () => nonZeroRows[0])),
      }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "statement.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([zeroRow]),
      }),
    ).rejects.toThrow();
  });

  it("permits extra columns but rejects missing or duplicate headers and invalid non-zero rows without exposing cells", async () => {
    const missingHeader = statementWorkbook(nonZeroRows);
    missingHeader.getWorksheet("כרטיסי אשראי")!.getRow(9).getCell(9).value = "סכום לא נכון";
    const duplicateHeader = statementWorkbook(nonZeroRows);
    duplicateHeader.getWorksheet("כרטיסי אשראי")!.insertRow(2, headers);
    const extraColumn = statementWorkbook(nonZeroRows);
    extraColumn.getWorksheet("כרטיסי אשראי")!.getRow(9).getCell(19).value = "עמודה נוספת";
    extraColumn.getWorksheet("כרטיסי אשראי")!.getRow(10).getCell(19).value = "ignored";

    await expect(
      parseStatementFile({
        name: "missing.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array(await missingHeader.xlsx.writeBuffer()),
      }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "duplicate.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array(await duplicateHeader.xlsx.writeBuffer()),
      }),
    ).rejects.toThrow();
    await expect(
      parseStatementFile({
        name: "extra.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: new Uint8Array(await extraColumn.xlsx.writeBuffer()),
      }),
    ).resolves.toMatchObject({ rows: expect.any(Array) });

    const unrelatedRawCell = "non-offending-raw-cell-sentinel";
    await expectSanitizedRowError(
      {
        name: "date.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([
          [...nonZeroRows[0].slice(0, 2), "31/02/2026", ...nonZeroRows[0].slice(3, 6), unrelatedRawCell, ...nonZeroRows[0].slice(7)],
        ]),
      },
      ["31/02/2026", unrelatedRawCell],
    );
    await expectSanitizedRowError(
      {
        name: "date-shape.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 2), "2026-07-14", ...nonZeroRows[0].slice(3)]]),
      },
      "2026-07-14",
    );
    await expectSanitizedRowError(
      {
        name: "date-padding.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 2), "1/7/2026", ...nonZeroRows[0].slice(3)]]),
      },
      "1/7/2026",
    );
    await expectSanitizedRowError(
      {
        name: "amount.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 8), "12.345"]]),
      },
      "12.345",
    );
    await expectSanitizedRowError(
      {
        name: "merchant.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[nonZeroRows[0][0], "   ", ...nonZeroRows[0].slice(2)]]),
      },
      "   ",
    );
    await expectSanitizedRowError(
      {
        name: "long-merchant.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[nonZeroRows[0][0], "x".repeat(201), ...nonZeroRows[0].slice(2)]]),
      },
      "x".repeat(201),
    );
    await expectSanitizedRowError(
      {
        name: "long-note.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: await xlsxFixture([[...nonZeroRows[0].slice(0, 6), "n".repeat(501), ...nonZeroRows[0].slice(7)]]),
      },
      "n".repeat(501),
    );
  });
});
