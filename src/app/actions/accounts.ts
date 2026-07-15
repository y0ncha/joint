"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/validation";

export async function createAccount(input: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("accounts").insert({
    household_id: household.householdId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    opening_balance: parsed.data.openingBalance,
    opening_balance_date: parsed.data.openingBalanceDate,
  });
  if (error) return { status: "error", formError: "Unable to save the account. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/accounts");
  return { status: "success" };
}

export async function updateAccount(accountId: string, input: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await (await createServerSupabaseClient()).from("accounts").update({
    name: parsed.data.name,
    kind: parsed.data.kind,
    opening_balance: parsed.data.openingBalance,
    opening_balance_date: parsed.data.openingBalanceDate,
  }).eq("id", accountId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the account. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/accounts");
  return { status: "success" };
}

export async function archiveAccount(accountId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const supabase = await createServerSupabaseClient();
  const { count, error: referenceError } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("household_id", household.householdId).or(`account_id.eq.${accountId},destination_account_id.eq.${accountId}`);
  if (referenceError) return { status: "error", formError: "Unable to check the account history. Please try again.", fieldErrors: {} };
  if ((count ?? 0) > 0) return { status: "error", formError: "Accounts with transaction history must remain available.", fieldErrors: {} };
  const { error } = await supabase.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", accountId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to archive the account. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/accounts");
  return { status: "success" };
}
