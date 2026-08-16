"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/result";
import { getIsoMonthRange } from "@/lib/date-range";
import { requireCurrentHousehold } from "@/lib/household";
import {
  confirmMerchantAutomationPreview,
  evaluateMerchantAutomations,
  getMerchantAutomationRules,
  previewMerchantAutomations,
} from "@/lib/merchant-automations";
import { confirmTransactionDuplicatePreview, loadTransactionDuplicatePreview } from "@/lib/transaction-duplicates";
import { parseStatementFile } from "@/lib/statement-import";

const MAX_FILE_BYTES = 1_048_576;
const FILE_ERROR = "Choose a CSV or XLSX file up to 1 MB.";
const IMPORT_ERROR = "Unable to process this file. Try again.";

function fileError(): ActionResult {
  return { status: "error", formError: FILE_ERROR, fieldErrors: { statement: FILE_ERROR } };
}

function hexDigest(bytes: ArrayBuffer) {
  return crypto.subtle
    .digest("SHA-256", bytes)
    .then((digest) => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
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
      formError: "This file was already imported.",
      fieldErrors: { statement: "Choose a different file." },
    };
  }

  let parsedStatement: Awaited<ReturnType<typeof parseStatementFile>>;
  try {
    parsedStatement = await parseStatementFile({ name: statement.name, type: statement.type, bytes });
  } catch (error) {
    const row = error instanceof Error ? /^row (\d+): invalid (?:date|amount|merchant|note|card)$/.exec(error.message)?.[1] : undefined;
    if (row) {
      const message = `Check row ${row} and try again.`;
      return { status: "error", formError: message, fieldErrors: { statement: message } };
    }
    return { status: "error", formError: "Unable to process this file. Review it and try again.", fieldErrors: {} };
  }

  const { data: cardMappings, error: cardMappingsError } = await household.supabase
    .from("member_cards")
    .select("last_four, user_id")
    .eq("household_id", household.householdId);

  if (cardMappingsError) return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };

  const payerByCard = new Map(cardMappings.map(({ last_four, user_id }) => [last_four, user_id]));
  let rules;
  try {
    rules = (await getMerchantAutomationRules(household.supabase, household.householdId)).filter((rule) => rule.action !== "delete_transaction");
  } catch {
    return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };
  }
  const rows = parsedStatement.rows.map((row) => {
    const automated = evaluateMerchantAutomations(
      { merchant: row.merchant, note: row.note, amount: row.amount, kind: row.kind, categoryId: null, subcategoryId: null },
      rules,
    );
    const servicePeriod = automated.assignsBills ? getIsoMonthRange(row.occurredOn.slice(0, 7)) : undefined;
    return {
      household_id: household.householdId,
      created_by: household.userId,
      paid_by: payerByCard.get(row.cardLastFour) ?? null,
      source: "statement_import" as const,
      ...(automated.categoryId ? { category_id: automated.categoryId } : {}),
      subcategory_id: automated.subcategoryId,
      merchant: automated.merchant,
      note: row.note,
      occurred_on: row.occurredOn,
      kind: row.kind,
      amount: row.amount,
      ...(servicePeriod ? { service_period_start: servicePeriod.from, service_period_end: servicePeriod.to } : {}),
      import_file_hash: importFileHash,
      import_row_number: row.importRowNumber,
    };
  });
  const automationPreview = previewMerchantAutomations(
    parsedStatement.rows.map((row) => ({
      id: String(row.importRowNumber),
      merchant: row.merchant,
      kind: row.kind,
      amount: row.amount,
      note: row.note,
      categoryId: null,
      subcategoryId: null,
      updatedAt: "new",
    })),
    rules,
  );
  const automationConfirmation = confirmMerchantAutomationPreview(formData, automationPreview);
  if (!automationConfirmation.confirmed) {
    if (automationConfirmation.stale)
      return { status: "error", formError: "This rules preview is stale. Import again to review the current changes.", fieldErrors: {} };
    return { status: "automation_confirmation_required", automationPreview };
  }
  let preview;
  try {
    preview = await loadTransactionDuplicatePreview(
      household.supabase,
      household.householdId,
      rows.map((row) => ({
        id: String(row.import_row_number),
        kind: row.kind,
        amount: row.amount,
        occurredOn: row.occurred_on,
        merchant: row.merchant,
      })),
      rows,
    );
  } catch {
    return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };
  }
  const confirmation = confirmTransactionDuplicatePreview(formData, preview);
  if (!confirmation.confirmed) {
    if (confirmation.stale)
      return {
        status: "error",
        formError: "This duplicate preview is stale. Import again to review the current matches.",
        fieldErrors: {},
      };
    return { status: "confirmation_required", duplicatePreview: preview };
  }
  const skippedIds = confirmation.skippedIds;
  const rowsToInsert = rows.filter((row) => !skippedIds.has(String(row.import_row_number)));
  const { error: insertError } = rowsToInsert.length ? await household.supabase.from("transactions").insert(rowsToInsert) : { error: null };

  if (insertError) return { status: "error", formError: IMPORT_ERROR, fieldErrors: {} };

  for (const path of ["/", "/transactions", "/categories", "/budgets-goals"]) revalidatePath(path);

  const importedRows = rowsToInsert.map((row) => ({ kind: row.kind, amount: row.amount, occurredOn: row.occurred_on }));
  const incomeTotal = importedRows.filter((row) => row.kind === "income").reduce((total, row) => total + row.amount, 0);
  const expenseTotal = importedRows.filter((row) => row.kind === "expense").reduce((total, row) => total + row.amount, 0);
  const dates = importedRows.map((row) => row.occurredOn).sort();

  return {
    status: "success",
    data: {
      importedRowCount: String(rowsToInsert.length),
      ...(skippedIds.size ? { skippedDuplicateCount: String(skippedIds.size) } : {}),
      skippedZeroCount: String(parsedStatement.skippedZeroCount),
      incomeTotal: incomeTotal.toFixed(2),
      expenseTotal: expenseTotal.toFixed(2),
      earliestOccurredOn: dates[0] ?? "",
      latestOccurredOn: dates.at(-1) ?? "",
    },
  };
}
