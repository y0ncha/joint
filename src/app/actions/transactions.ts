"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validation";

async function getSharedAccountId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, householdId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("household_id", householdId)
    .eq("kind", "bank")
    .is("archived_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

async function validatePaidBy(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
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

export async function createTransaction(input: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const household = await requireCurrentHousehold();
  const supabase = await createServerSupabaseClient();
  const accountId = await getSharedAccountId(supabase, household.householdId);
  if (!accountId) return { status: "error", formError: "Set up your shared balance before adding transactions.", fieldErrors: {} };
  if (!(await validatePaidBy(supabase, household.householdId, parsed.data.paidBy))) {
    return { status: "error", formError: "Choose a household member for this transaction.", fieldErrors: { paidBy: "Choose a household member." } };
  }

  const { error } = await supabase.from("transactions").insert({
    household_id: household.householdId,
    created_by: household.userId,
    paid_by: parsed.data.paidBy,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    account_id: accountId,
    destination_account_id: null,
    category_id: parsed.data.categoryId,
    note: parsed.data.note,
  });

  if (error) {
    return { status: "error", formError: "Unable to save the transaction. Please try again.", fieldErrors: {} };
  }

  for (const path of ["/", "/transactions", "/categories"]) {
    revalidatePath(path);
  }
  return { status: "success" };
}

export async function updateTransaction(transactionId: string, input: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const supabase = await createServerSupabaseClient();
  const accountId = await getSharedAccountId(supabase, household.householdId);
  if (!accountId) return { status: "error", formError: "Set up your shared balance before updating transactions.", fieldErrors: {} };
  if (!(await validatePaidBy(supabase, household.householdId, parsed.data.paidBy))) {
    return { status: "error", formError: "Choose a household member for this transaction.", fieldErrors: { paidBy: "Choose a household member." } };
  }

  const { error } = await supabase.from("transactions").update({
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    account_id: accountId,
    paid_by: parsed.data.paidBy,
    destination_account_id: null,
    category_id: parsed.data.categoryId,
    note: parsed.data.note,
  }).eq("id", transactionId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the transaction. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories"]) revalidatePath(path);
  return { status: "success" };
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await (await createServerSupabaseClient())
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the transaction. Please try again.", fieldErrors: {} };
  for (const path of ["/", "/transactions", "/categories"]) revalidatePath(path);
  return { status: "success" };
}
