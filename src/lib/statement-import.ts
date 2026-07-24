import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

const MAX_BYTES = 1_048_576;
const MAX_ROWS = 1_000;
const REQUIRED_HEADERS = ["כרטיס", "בית עסק", "תאריך עסקה", "פירוט", "סכום החיוב"] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type HeaderColumns = Record<RequiredHeader, number>;

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

type StatementInput = {
  name: string;
  type: string;
  bytes: Uint8Array;
};

class StatementParseError extends Error {}

function invalidFile(): never {
  throw new StatementParseError("Invalid statement file.");
}

function invalidRow(rowNumber: number, field: string): never {
  throw new StatementParseError(`row ${rowNumber}: invalid ${field}`);
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function fileKind(input: StatementInput): "csv" | "xlsx" {
  const name = input.name.toLowerCase();
  if (input.bytes.length > MAX_BYTES) invalidFile();

  if (name.endsWith(".xlsx")) {
    if (!hasPrefix(input.bytes, [0x50, 0x4b, 0x03, 0x04])) invalidFile();
    if (Buffer.from(input.bytes).includes(Buffer.from("xl/vbaProject.bin"))) invalidFile();
    return "xlsx";
  }

  if (name.endsWith(".csv")) {
    if (hasPrefix(input.bytes, [0x50, 0x4b]) || hasPrefix(input.bytes, [0xd0, 0xcf, 0x11, 0xe0])) invalidFile();
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      invalidFile();
    }
    return "csv";
  }

  invalidFile();
}

async function loadWorkbook(kind: "csv" | "xlsx", bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  if (kind === "xlsx") {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } else {
    await workbook.csv.read(Readable.from([Buffer.from(bytes)]), { map: (value) => value });
  }
  return workbook;
}

function textAt(row: ExcelJS.Row, column: number) {
  return row.getCell(column).text.trim();
}

function rawTextAt(row: ExcelJS.Row, column: number) {
  return row.getCell(column).text;
}

function findHeader(workbook: ExcelJS.Workbook) {
  const matches: Array<{ worksheet: ExcelJS.Worksheet; rowNumber: number; columns: HeaderColumns }> = [];

  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const columns = {} as HeaderColumns;
      let isMatch = true;

      for (const header of REQUIRED_HEADERS) {
        const matchesInRow: number[] = [];
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          if (cell.text === header) matchesInRow.push(columnNumber);
        });
        if (matchesInRow.length !== 1) {
          isMatch = false;
          break;
        }
        columns[header] = matchesInRow[0];
      }

      if (isMatch) matches.push({ worksheet, rowNumber, columns });
    });
  }

  if (matches.length !== 1) invalidFile();
  return matches[0];
}

function parseDate(value: string, rowNumber: number) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) invalidRow(rowNumber, "date");

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const daysInMonth = month === 2
    ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

  if (!year || !daysInMonth || day < 1 || day > daysInMonth) invalidRow(rowNumber, "date");
  return `${yearText}-${monthText}-${dayText}`;
}

function parseAmount(value: string, rowNumber: number) {
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) invalidRow(rowNumber, "amount");

  const [, sign, whole, fractional = ""] = match;
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) invalidRow(rowNumber, "amount");
  if (cents === 0) return null;

  return { kind: sign === "-" ? "income" as const : "expense" as const, amount: cents / 100 };
}

function parseRows(header: { worksheet: ExcelJS.Worksheet; rowNumber: number; columns: HeaderColumns }): ParsedStatement {
  const rows: ParsedStatement["rows"] = [];
  let skippedZeroCount = 0;
  let statementRowCount = 0;

  header.worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;

    const chargedAmount = rawTextAt(row, header.columns["סכום החיוב"]);
    if (!chargedAmount) return;
    statementRowCount += 1;
    if (statementRowCount > MAX_ROWS) invalidFile();

    const amount = parseAmount(chargedAmount, rowNumber);
    if (!amount) {
      skippedZeroCount += 1;
      return;
    }

    const merchant = textAt(row, header.columns["בית עסק"]);
    if (merchant.length < 1 || merchant.length > 200) invalidRow(rowNumber, "merchant");

    const note = textAt(row, header.columns["פירוט"]);
    if (note.length > 500) invalidRow(rowNumber, "note");

    const card = textAt(row, header.columns["כרטיס"]);
    const cardLastFour = /(\d{4})\s*$/.exec(card)?.[1];
    if (!cardLastFour) invalidRow(rowNumber, "card");

    rows.push({
      importRowNumber: rowNumber,
      cardLastFour,
      merchant,
      occurredOn: parseDate(rawTextAt(row, header.columns["תאריך עסקה"]), rowNumber),
      kind: amount.kind,
      amount: amount.amount,
      note,
    });
  });

  if (rows.length === 0) invalidFile();
  return { rows, skippedZeroCount };
}

export async function parseStatementFile(input: StatementInput): Promise<ParsedStatement> {
  try {
    const workbook = await loadWorkbook(fileKind(input), input.bytes);
    return parseRows(findHeader(workbook));
  } catch (error) {
    if (error instanceof StatementParseError) throw error;
    return invalidFile();
  }
}
