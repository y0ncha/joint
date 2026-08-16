"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { getIsoMonthRange } from "@/lib/date-range";
import { requireCurrentHousehold } from "@/lib/household";
import {
  confirmMerchantAutomationPreview,
  evaluateMerchantAutomations,
  getMerchantAutomationRules,
  previewMerchantAutomations,
} from "@/lib/merchant-automations";
import {
  confirmTransactionDuplicatePreview,
  duplicateFormSnapshot,
  loadTransactionDuplicatePreview,
  type DuplicateCandidate,
} from "@/lib/transaction-duplicates";
import { transactionSchema } from "@/lib/validation";

async function validatePaidBy(
  supabase: Awaited<ReturnType<typeof requireCurrentHousehold>>["supabase"],
  householdId: string,
  paidBy: string,
) {
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", paidBy)
    .maybeSingle();

  return !error && Boolean(data);
}

async function servicePeriodsFor(
  household: Awaited<ReturnType<typeof requireCurrentHousehold>>,
  subcategoryId: string | null,
  servicePeriodStart: string | null,
  servicePeriodEnd: string | null,
  automatedMonth?: string,
): Promise<{ service_period_start: string | null; service_period_end: string | null } | ActionResult> {
  if (!subcategoryId) return { service_period_start: null, service_period_end: null };

  const { data, error } = await household.supabase
    .from("subcategories")
    .select("category_id, categories!inner(system_key)")
    .eq("id", subcategoryId)
    .eq("household_id", household.householdId)
    .maybeSingle();
  const systemKey = (data as { categories: { system_key: string | null } | null } | null)?.categories?.system_key;
  if (error || !data) {
    return { status: "error", formError: "Check the form details.", fieldErrors: { subcategoryId: "Select a value." } };
  }
  if (systemKey !== "bills") return { service_period_start: null, service_period_end: null };
  const defaultPeriod = automatedMonth ? getIsoMonthRange(automatedMonth) : undefined;
  if (!servicePeriodStart && !servicePeriodEnd && defaultPeriod) {
    return { service_period_start: defaultPeriod.from, service_period_end: defaultPeriod.to };
  }
  if (!servicePeriodStart || !servicePeriodEnd) {
    return { status: "error", formError: "Check the form details.", fieldErrors: { servicePeriodEnd: "Choose a billing period." } };
  }
  return { service_period_start: servicePeriodStart, service_period_end: servicePeriodEnd };
}

export async function createTransaction(input: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const household = await requireCurrentHousehold();
  let rules;
  try {
    rules = (await getMerchantAutomationRules(household.supabase, household.householdId)).filter(
      (rule) => rule.action !== "delete_transaction",
    );
  } catch {
    return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
  }
  const automated = evaluateMerchantAutomations(
    {
      merchant: parsed.data.merchant ?? "",
      note: parsed.data.note,
      amount: parsed.data.amount,
      kind: parsed.data.kind,
      categoryId: parsed.data.categoryId,
      subcategoryId: parsed.data.subcategoryId,
    },
    rules,
  );
  if (!automated.subcategoryId && !automated.categoryId) {
    return { status: "error", formError: "Check the form details.", fieldErrors: { subcategoryId: "Select a value." } };
  }
  const servicePeriods = await servicePeriodsFor(
    household,
    automated.subcategoryId,
    parsed.data.servicePeriodStart,
    parsed.data.servicePeriodEnd,
    automated.assignsBills ? parsed.data.occurredOn.slice(0, 7) : undefined,
  );
  if ("status" in servicePeriods) return servicePeriods;
  if (parsed.data.paidBy && !(await validatePaidBy(household.supabase, household.householdId, parsed.data.paidBy))) {
    return {
      status: "error",
      formError: "Choose a household member for this transaction.",
      fieldErrors: { paidBy: "Choose a household member." },
    };
  }
  const automationPreview = previewMerchantAutomations(
    [
      {
        id: "manual",
        merchant: parsed.data.merchant ?? "",
        kind: parsed.data.kind,
        amount: parsed.data.amount,
        note: parsed.data.note,
        categoryId: parsed.data.categoryId,
        subcategoryId: parsed.data.subcategoryId,
        updatedAt: "new",
      },
    ],
    rules,
  );
  const automationConfirmation = confirmMerchantAutomationPreview(input, automationPreview);
  if (!automationConfirmation.confirmed) {
    if (automationConfirmation.stale)
      return { status: "error", formError: "This rules preview is stale. Save again to review the current changes.", fieldErrors: {} };
    return { status: "automation_confirmation_required", automationPreview };
  }
  const candidate = {
    id: "manual",
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurredOn: parsed.data.occurredOn,
    merchant: automated.merchant,
  } satisfies DuplicateCandidate;
  let preview;
  try {
    preview = await loadTransactionDuplicatePreview(household.supabase, household.householdId, [candidate], duplicateFormSnapshot(input));
  } catch {
    return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
  }
  const confirmation = confirmTransactionDuplicatePreview(input, preview);
  if (!confirmation.confirmed) {
    if (confirmation.stale)
      return { status: "error", formError: "This duplicate preview is stale. Save again to review the current matches.", fieldErrors: {} };
    return { status: "confirmation_required", duplicatePreview: preview };
  }
  const recurringScheduleArgs =
    parsed.data.recurrenceCadence && parsed.data.recurrenceInterval
      ? {
          target_household_id: household.householdId,
          target_kind: parsed.data.kind,
          target_amount: parsed.data.amount,
          target_occurred_on: parsed.data.occurredOn,
          target_merchant: automated.merchant,
          target_note: parsed.data.note,
          target_cadence: parsed.data.recurrenceCadence,
          target_interval_count: parsed.data.recurrenceInterval,
          ...(parsed.data.paidBy ? { target_paid_by: parsed.data.paidBy } : {}),
          ...(automated.categoryId ? { target_category_id: automated.categoryId } : {}),
          ...(automated.subcategoryId ? { target_subcategory_id: automated.subcategoryId } : {}),
          ...(servicePeriods.service_period_start ? { target_service_period_start: servicePeriods.service_period_start } : {}),
          ...(servicePeriods.service_period_end ? { target_service_period_end: servicePeriods.service_period_end } : {}),
        }
      : null;
  if (confirmation.skippedIds.has(candidate.id)) {
    const existingScheduleId = preview.matches.find(({ candidate: matchedCandidate }) => matchedCandidate.id === candidate.id)?.existing
      .recurringScheduleId;
    if (recurringScheduleArgs && !existingScheduleId) {
      const existingTransactionId = preview.matches.find(({ candidate: matchedCandidate }) => matchedCandidate.id === candidate.id)
        ?.existing.id;
      if (!existingTransactionId)
        return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
      const { error } = await household.supabase.rpc("create_recurring_transaction_schedule_after_duplicate", {
        ...recurringScheduleArgs,
        target_existing_transaction_id: existingTransactionId,
      });
      if (error) return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
      for (const path of ["/", "/transactions", "/categories", "/bills-groceries"]) revalidatePath(path);
    }
    return { status: "success", data: { skippedDuplicateCount: "1" } };
  }

  const transactionValues = {
    household_id: household.householdId,
    created_by: household.userId,
    paid_by: parsed.data.paidBy,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    ...(automated.categoryId ? { category_id: automated.categoryId } : {}),
    subcategory_id: automated.subcategoryId,
    note: parsed.data.note,
    ...(parsed.data.merchant === undefined ? {} : { merchant: automated.merchant }),
    ...servicePeriods,
  };

  const { error } = recurringScheduleArgs
    ? await household.supabase.rpc("create_recurring_transaction_schedule", recurringScheduleArgs)
    : await household.supabase.from("transactions").insert(transactionValues);

  if (error) {
    return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
  }

  for (const path of ["/", "/transactions", "/categories", "/bills-groceries", "/budgets-goals"]) {
    revalidatePath(path);
  }
  return { status: "success" };
}

export async function updateTransaction(transactionId: string, input: FormData): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { data: existingTransaction, error: sourceError } = await household.supabase
    .from("transactions")
    .select("source, recurring_schedule_id")
    .eq("id", transactionId)
    .eq("household_id", household.householdId)
    .maybeSingle();
  if (sourceError || !existingTransaction)
    return { status: "error", formError: "Unable to update the transaction. Please try again.", fieldErrors: {} };

  const parsed = transactionSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  if (existingTransaction.source === "manual" && !parsed.data.subcategoryId && !parsed.data.categoryId) {
    return { status: "error", formError: "Check the form details.", fieldErrors: { subcategoryId: "Select a value." } };
  }
  const servicePeriods = await servicePeriodsFor(
    household,
    parsed.data.subcategoryId,
    parsed.data.servicePeriodStart,
    parsed.data.servicePeriodEnd,
  );
  if ("status" in servicePeriods) return servicePeriods;
  if (parsed.data.paidBy && !(await validatePaidBy(household.supabase, household.householdId, parsed.data.paidBy))) {
    return {
      status: "error",
      formError: "Choose a household member for this transaction.",
      fieldErrors: { paidBy: "Choose a household member." },
    };
  }

  const recurrenceScope = input.get("recurrenceScope");
  if ((recurrenceScope === "future" || recurrenceScope === "all") && existingTransaction.recurring_schedule_id) {
    const { error } = await household.supabase.rpc("update_recurring_transaction_occurrence", {
      target_amount: parsed.data.amount,
      target_category_id: parsed.data.categoryId || null,
      target_merchant: parsed.data.merchant ?? "",
      target_note: parsed.data.note,
      target_paid_by: parsed.data.paidBy || null,
      target_scope: recurrenceScope,
      target_service_period_end: servicePeriods.service_period_end,
      target_service_period_start: servicePeriods.service_period_start,
      target_subcategory_id: parsed.data.subcategoryId || null,
      target_transaction_id: transactionId,
    } as never);
    if (error) return { status: "error", formError: "Unable to update the recurring schedule. Please try again.", fieldErrors: {} };
    for (const path of ["/", "/transactions", "/categories", "/bills-groceries", "/budgets-goals"]) revalidatePath(path);
    return { status: "success" };
  }

  const { error } = await household.supabase
    .from("transactions")
    .update({
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      occurred_on: parsed.data.occurredOn,
      paid_by: parsed.data.paidBy,
      ...(input.has("categoryId") ? { category_id: parsed.data.categoryId || null } : {}),
      subcategory_id: parsed.data.subcategoryId,
      note: parsed.data.note,
      ...(parsed.data.merchant === undefined ? {} : { merchant: parsed.data.merchant }),
      ...servicePeriods,
    })
    .eq("id", transactionId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the transaction. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries", "/budgets-goals"]) revalidatePath(path);
  return { status: "success" };
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the transaction. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries", "/budgets-goals"]) revalidatePath(path);
  return { status: "success" };
}

export async function deleteTransactions(transactionIds: string[]): Promise<ActionResult> {
  const ids = [...new Set(transactionIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { status: "error", formError: "Select at least one transaction.", fieldErrors: {} };

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("transactions").delete().in("id", ids).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the selected transactions. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries", "/budgets-goals"]) revalidatePath(path);
  return { status: "success" };
}
