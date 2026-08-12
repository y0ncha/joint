import "server-only";
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { inflateRawSync } from "node:zlib";

const MAX_BYTES = 1_048_576;
const MAX_ROWS = 1_000;
const MAX_XLSX_WORKSHEETS = 32;
const MAX_XLSX_WORKSHEET_ROWS = MAX_ROWS + 100;
const MAX_XLSX_WORKSHEET_COLUMNS = 64;
const MAX_XLSX_MERGE_RANGES = 64;
const MAX_XLSX_MERGED_CELLS = MAX_XLSX_WORKSHEET_ROWS * MAX_XLSX_WORKSHEET_COLUMNS;
const MAX_XLSX_SHARED_STRINGS = MAX_XLSX_MERGED_CELLS;
const MAX_XLSX_STYLES = 1_024;
const MAX_XLSX_ENTRIES = 256;
const MAX_XLSX_UNCOMPRESSED_BYTES = 8 * MAX_BYTES;
const MAX_XLSX_COMPRESSION_RATIO = 100;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = [0x50, 0x4b, 0x01, 0x02] as const;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = [0x50, 0x4b, 0x05, 0x06] as const;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
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

type XlsxWorksheetInternals = { _rows?: unknown[] };
type XlsxRowInternals = { _cells?: unknown[] };

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

function readZipU16(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) invalidFile();
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readZipU32(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) invalidFile();
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function zipSignatureAt(bytes: Uint8Array, offset: number, signature: readonly number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function worksheetColumnNumber(value: string) {
  let result = 0;
  for (const character of value.toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function validateWorksheetMergeRef(value: string) {
  const cells = value.split(":");
  if (cells.length > 2) invalidFile();

  const parsed = cells.map((cell) => {
    const match = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(cell);
    if (!match) invalidFile();
    const row = Number(match[2]);
    const column = worksheetColumnNumber(match[1]);
    if (!Number.isSafeInteger(row) || row > MAX_XLSX_WORKSHEET_ROWS || column > MAX_XLSX_WORKSHEET_COLUMNS) invalidFile();
    return { column, row };
  });

  if (parsed.length === 1) return 1;
  if (parsed[0].column > parsed[1].column || parsed[0].row > parsed[1].row) invalidFile();
  return (parsed[1].column - parsed[0].column + 1) * (parsed[1].row - parsed[0].row + 1);
}

function validateWorksheetXml(bytes: Uint8Array) {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const mergeCellTags = /<mergeCell\b[^>]*>/gi;
  const refAttribute = /\bref\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
  let rowElementCount = 0;
  let cellElementCount = 0;
  let mergeRangeCount = 0;
  let mergedCellCount = 0;

  for (const match of xml.matchAll(/<row\b/gi)) {
    if (!match[0]) continue;
    rowElementCount += 1;
    if (rowElementCount > MAX_XLSX_WORKSHEET_ROWS) invalidFile();
  }
  for (const match of xml.matchAll(/<c\b/gi)) {
    if (!match[0]) continue;
    cellElementCount += 1;
    if (cellElementCount > MAX_XLSX_MERGED_CELLS) invalidFile();
  }

  for (const match of xml.matchAll(mergeCellTags)) {
    mergeRangeCount += 1;
    if (mergeRangeCount > MAX_XLSX_MERGE_RANGES) invalidFile();
    const ref = refAttribute.exec(match[0]);
    if (!ref) invalidFile();
    mergedCellCount += validateWorksheetMergeRef(ref[1] ?? ref[2]);
    if (mergedCellCount > MAX_XLSX_MERGED_CELLS) invalidFile();
  }
}

function validateCsvColumns(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let columns = 1;
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === ",") {
      columns += 1;
      if (columns > MAX_XLSX_WORKSHEET_COLUMNS) invalidFile();
    } else if (!quoted && character === "\n") {
      columns = 1;
    }
  }
}

function validateXmlElementCount(bytes: Uint8Array, element: string, max: number) {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const tag = new RegExp(`<${element}\\b`, "gi");
  let count = 0;
  for (const match of xml.matchAll(tag)) {
    if (!match[0]) continue;
    count += 1;
    if (count > max) invalidFile();
  }
}

function findZipEndOfCentralDirectory(bytes: Uint8Array) {
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (!zipSignatureAt(bytes, offset, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE)) continue;
    const commentLength = readZipU16(bytes, offset + 20);
    if (offset + 22 + commentLength <= bytes.length) return offset;
  }
  invalidFile();
}

function preflightXlsx(bytes: Uint8Array) {
  const endOfCentralDirectory = findZipEndOfCentralDirectory(bytes);
  const diskNumber = readZipU16(bytes, endOfCentralDirectory + 4);
  const centralDirectoryDisk = readZipU16(bytes, endOfCentralDirectory + 6);
  const entriesOnDisk = readZipU16(bytes, endOfCentralDirectory + 8);
  const entryCount = readZipU16(bytes, endOfCentralDirectory + 10);
  const centralDirectorySize = readZipU32(bytes, endOfCentralDirectory + 12);
  const centralDirectoryOffset = readZipU32(bytes, endOfCentralDirectory + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount > MAX_XLSX_ENTRIES ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    invalidFile();
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryOffset < 0 || centralDirectoryEnd > endOfCentralDirectory || centralDirectoryEnd < centralDirectoryOffset) {
    invalidFile();
  }

  let cursor = centralDirectoryOffset;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralDirectoryEnd || !zipSignatureAt(bytes, cursor, ZIP_CENTRAL_DIRECTORY_SIGNATURE)) invalidFile();

    const compressedSize = readZipU32(bytes, cursor + 20);
    const uncompressedSize = readZipU32(bytes, cursor + 24);
    const compressionMethod = readZipU16(bytes, cursor + 10);
    const fileNameLength = readZipU16(bytes, cursor + 28);
    const extraFieldLength = readZipU16(bytes, cursor + 30);
    const commentLength = readZipU16(bytes, cursor + 32);
    const localHeaderOffset = readZipU32(bytes, cursor + 42);
    const recordEnd = cursor + 46 + fileNameLength + extraFieldLength + commentLength;

    if (
      recordEnd > centralDirectoryEnd ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      uncompressedSize > MAX_XLSX_UNCOMPRESSED_BYTES ||
      (compressedSize === 0 ? uncompressedSize > 0 : uncompressedSize > compressedSize * MAX_XLSX_COMPRESSION_RATIO)
    ) {
      invalidFile();
    }

    const localHeaderEnd = localHeaderOffset + 30;
    if (localHeaderEnd > bytes.length || !zipSignatureAt(bytes, localHeaderOffset, ZIP_LOCAL_FILE_HEADER_SIGNATURE)) invalidFile();
    const localFileNameLength = readZipU16(bytes, localHeaderOffset + 26);
    const localExtraFieldLength = readZipU16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderEnd + localFileNameLength + localExtraFieldLength;
    if (dataStart + compressedSize > bytes.length || dataStart + compressedSize < dataStart) invalidFile();

    const fileName = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    if (fileName.startsWith("/")) invalidFile();
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(fileName) || fileName === "xl/sharedStrings.xml" || fileName === "xl/styles.xml") {
      let worksheetBytes: Uint8Array;
      try {
        const compressed = Buffer.from(bytes.slice(dataStart, dataStart + compressedSize));
        worksheetBytes =
          compressionMethod === 0
            ? new Uint8Array(compressed)
            : compressionMethod === 8
              ? new Uint8Array(inflateRawSync(compressed, { maxOutputLength: MAX_XLSX_UNCOMPRESSED_BYTES }))
              : invalidFile();
      } catch {
        invalidFile();
      }
      if (worksheetBytes.length !== uncompressedSize) invalidFile();
      if (/^xl\/worksheets\/[^/]+\.xml$/i.test(fileName)) validateWorksheetXml(worksheetBytes);
      else if (fileName === "xl/sharedStrings.xml") validateXmlElementCount(worksheetBytes, "si", MAX_XLSX_SHARED_STRINGS);
      else validateXmlElementCount(worksheetBytes, "xf", MAX_XLSX_STYLES);
    }

    totalCompressedBytes += compressedSize;
    totalUncompressedBytes += uncompressedSize;
    if (
      totalUncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES ||
      (totalCompressedBytes === 0 ? totalUncompressedBytes > 0 : totalUncompressedBytes > totalCompressedBytes * MAX_XLSX_COMPRESSION_RATIO)
    ) {
      invalidFile();
    }

    cursor = recordEnd;
  }

  if (cursor !== centralDirectoryEnd) invalidFile();
}

function fileKind(input: StatementInput): "csv" | "xlsx" {
  const name = input.name.toLowerCase();
  if (input.bytes.length > MAX_BYTES) invalidFile();

  if (name.endsWith(".xlsx")) {
    if (!hasPrefix(input.bytes, ZIP_LOCAL_FILE_HEADER_SIGNATURE)) invalidFile();
    if (Buffer.from(input.bytes).includes(Buffer.from("xl/vbaProject.bin"))) invalidFile();
    preflightXlsx(input.bytes);
    return "xlsx";
  }

  if (name.endsWith(".csv")) {
    if (hasPrefix(input.bytes, [0x50, 0x4b]) || hasPrefix(input.bytes, [0xd0, 0xcf, 0x11, 0xe0])) invalidFile();
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      invalidFile();
    }
    validateCsvColumns(input.bytes);
    return "csv";
  }

  invalidFile();
}

async function loadWorkbook(kind: "csv" | "xlsx", bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  if (kind === "xlsx") {
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } else {
    await workbook.csv.read(Readable.from([Buffer.from(bytes)]), {
      map: (value) => value,
      parserOptions: { maxRows: MAX_XLSX_WORKSHEET_ROWS + 1 },
    });
  }
  return workbook;
}

function validateWorkbookShape(workbook: ExcelJS.Workbook) {
  if (workbook.worksheets.length > MAX_XLSX_WORKSHEETS) invalidFile();

  for (const worksheet of workbook.worksheets) {
    const rows = (worksheet as unknown as XlsxWorksheetInternals)._rows;
    if (!Array.isArray(rows) || rows.length > MAX_XLSX_WORKSHEET_ROWS) invalidFile();

    for (const rowKey of Object.keys(rows)) {
      const rowIndex = Number(rowKey);
      if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || rowIndex + 1 > MAX_XLSX_WORKSHEET_ROWS) invalidFile();

      const cells = (rows[rowIndex] as XlsxRowInternals | undefined)?._cells;
      if (cells !== undefined && (!Array.isArray(cells) || cells.length > MAX_XLSX_WORKSHEET_COLUMNS)) invalidFile();
    }
  }
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
    worksheet.eachRow((row, rowNumber) => {
      const columns = {} as HeaderColumns;
      let isMatch = true;

      for (const header of REQUIRED_HEADERS) {
        const matchesInRow: number[] = [];
        row.eachCell((cell, columnNumber) => {
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
  const daysInMonth =
    month === 2
      ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
        ? 29
        : 28
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

  return { kind: sign === "-" ? ("income" as const) : ("expense" as const), amount: cents / 100 };
}

function parseRows(header: { worksheet: ExcelJS.Worksheet; rowNumber: number; columns: HeaderColumns }): ParsedStatement {
  const rows: ParsedStatement["rows"] = [];
  let skippedZeroCount = 0;
  let statementRowCount = 0;

  header.worksheet.eachRow((row, rowNumber) => {
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
    validateWorkbookShape(workbook);
    return parseRows(findHeader(workbook));
  } catch (error) {
    if (error instanceof StatementParseError) throw error;
    return invalidFile();
  }
}
