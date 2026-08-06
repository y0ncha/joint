"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
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
  if (!parsed.data.subcategoryId && !parsed.data.categoryId) {
    return { status: "error", formError: "Check the form details.", fieldErrors: { subcategoryId: "Select a value." } };
  }

  const household = await requireCurrentHousehold();
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

  const { error } = await household.supabase.from("transactions").insert({
    household_id: household.householdId,
    created_by: household.userId,
    paid_by: parsed.data.paidBy,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    ...(parsed.data.categoryId ? { category_id: parsed.data.categoryId } : {}),
    subcategory_id: parsed.data.subcategoryId,
    note: parsed.data.note,
    ...(parsed.data.merchant === undefined ? {} : { merchant: parsed.data.merchant }),
    ...servicePeriods,
  });

  if (error) {
    return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
  }

  for (const path of ["/", "/transactions", "/categories", "/bills-groceries"]) {
    revalidatePath(path);
  }
  return { status: "success" };
}

export async function updateTransaction(transactionId: string, input: FormData): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { data: existingTransaction, error: sourceError } = await household.supabase
    .from("transactions")
    .select("source")
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
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries"]) revalidatePath(path);
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
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries"]) revalidatePath(path);
  return { status: "success" };
}

export async function deleteTransactions(transactionIds: string[]): Promise<ActionResult> {
  const ids = [...new Set(transactionIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { status: "error", formError: "Select at least one transaction.", fieldErrors: {} };

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("transactions").delete().in("id", ids).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the selected transactions. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories", "/bills-groceries"]) revalidatePath(path);
  return { status: "success" };
}
