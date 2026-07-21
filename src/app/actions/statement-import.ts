"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { parseStatementFile } from "@/lib/statement-import";

const MAX_FILE_BYTES = 1_048_576;
const FILE_ERROR = "Choose a CSV or XLSX file no larger than 1 MiB.";
const IMPORT_ERROR = "Unable to import this statement. Please try again.";

function fileError(): ActionResult {
  return { status: "error", formError: FILE_ERROR, fieldErrors: { statement: FILE_ERROR } };
}

function hexDigest(bytes: ArrayBuffer) {
  return crypto.subtle.digest("SHA-256", bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

export async function importStatement(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const statement = formData.get("statement");
  if (!(statement instanceof File) || statement.size > MAX_FILE_BYTES) return fileError();

  const household = await requireCurrentHousehold();
  const fileBytes = await statement.arrayBuffer();
  const bytes = new Uint8Array(fileBytes);
  const importFileHash = await hexDigest(fileBytes);

  const { data: duplicateMatches, error: duplicateError } = await household.supabase
    .from("transactions")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("import_file_hash", importFileHash)
    .limit(1);
  const duplicate = duplicateMatches?.[0];

  if (duplicateError) return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };
  if (duplicate) {
    return {
      status: "error",
      formError: "This statement was already imported.",
      fieldErrors: { statement: "Choose a different statement file." },
    };
  }

  let parsedStatement: Awaited<ReturnType<typeof parseStatementFile>>;
  try {
    parsedStatement = await parseStatementFile({ name: statement.name, type: statement.type, bytes });
  } catch {
    return { status: "error", formError: "Unable to import this statement. Please review the file and try again.", fieldErrors: {} };
  }

  const { data: cardMappings, error: cardMappingsError } = await household.supabase
    .from("member_card_mappings")
    .select("last_four, user_id")
    .eq("household_id", household.householdId);

  if (cardMappingsError) return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };

  const payerByCard = new Map(cardMappings.map(({ last_four, user_id }) => [last_four, user_id]));
  const rows = parsedStatement.rows.map((row) => ({
    household_id: household.householdId,
    created_by: household.userId,
    paid_by: payerByCard.get(row.cardLastFour) ?? null,
    source: "statement_import" as const,
    category_id: null,
    merchant: row.merchant,
    note: row.note,
    occurred_on: row.occurredOn,
    kind: row.kind,
    amount: row.amount,
    import_file_hash: importFileHash,
    import_row_number: row.importRowNumber,
  }));
  const { error: insertError } = await household.supabase.from("transactions").insert(rows);

  if (insertError) return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };

  for (const path of ["/", "/transactions", "/categories"]) revalidatePath(path);

  const incomeTotal = parsedStatement.rows.filter((row) => row.kind === "income").reduce((total, row) => total + row.amount, 0);
  const expenseTotal = parsedStatement.rows.filter((row) => row.kind === "expense").reduce((total, row) => total + row.amount, 0);
  const dates = parsedStatement.rows.map((row) => row.occurredOn).sort();

  return {
    status: "success",
    data: {
      importedRowCount: String(rows.length),
      skippedZeroCount: String(parsedStatement.skippedZeroCount),
      incomeTotal: incomeTotal.toFixed(2),
      expenseTotal: expenseTotal.toFixed(2),
      earliestOccurredOn: dates[0],
      latestOccurredOn: dates.at(-1)!,
    },
  };
}
