"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/database.types";
import { getHouseholdForUser } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = {
  status: "error";
  formError: string;
  fieldErrors: Record<string, string>;
};

const householdName = z.string().trim().min(1, "Enter a household name.").max(80, "Use 80 characters or fewer.");
const openingBalance = z.coerce
  .number()
  .nonnegative("Enter zero or a positive amount.")
  .refine((amount) => Number.isInteger(amount * 100), "Use no more than two decimal places.");
const openingBalanceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function errorResult(formError: string, fieldErrors: Record<string, string> = {}): ActionResult {
  return { status: "error", formError, fieldErrors };
}

function isMembershipUniqueViolation(error: { code?: string; message?: string; details?: string } | null) {
  return error?.code === "23505" && [error.message, error.details]
    .some((value) => value?.includes("household_members_user_id_key"));
}

async function verifiedUserId(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims?.sub ?? null;
}

export async function createHousehold(input: FormData): Promise<ActionResult> {
  const name = householdName.safeParse(input.get("name"));
  const balance = openingBalance.safeParse(input.get("openingBalance"));
  const balanceDate = openingBalanceDate.safeParse(input.get("openingBalanceDate"));
  const fieldErrors: Record<string, string> = {};

  if (!name.success) {
    fieldErrors.name = name.error.issues[0]?.message ?? "Invalid name.";
  }
  if (!balance.success) {
    fieldErrors.openingBalance = balance.error.issues[0]?.message ?? "Invalid opening balance.";
  }
  if (!balanceDate.success) {
    fieldErrors.openingBalanceDate = balanceDate.error.issues[0]?.message ?? "Invalid balance date.";
  }
  if (!name.success || !balance.success || !balanceDate.success) {
    return errorResult("Check the household setup details.", fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const userId = await verifiedUserId(supabase);
  if (!userId) return errorResult("Please sign in before creating a household.");

  if (await getHouseholdForUser(supabase, userId)) {
    return errorResult("You already belong to a household.");
  }

  const householdId = crypto.randomUUID();
  const { error } = await supabase
    .from("households")
    .insert({ id: householdId, name: name.data, created_by: userId });

  if (isMembershipUniqueViolation(error)) return errorResult("You already belong to a household.");
  if (error) return errorResult("Unable to create your household. Please try again.");

  const household = await getHouseholdForUser(supabase, userId);
  if (!household || household.householdId !== householdId || household.role !== "owner") {
    return errorResult("Unable to confirm your household membership. Please try again.");
  }

  const { error: accountError } = await supabase.from("accounts").insert({
    household_id: householdId,
    name: "Shared balance",
    kind: "bank",
    opening_balance: balance.data,
    opening_balance_date: balanceDate.data,
  });

  if (accountError) return errorResult("Unable to set up your shared balance. Please try again.");

  redirect("/");
}

export async function acceptInvitation(input: FormData): Promise<ActionResult> {
  const token = input.get("token");
  if (typeof token !== "string" || !token) return errorResult("This invitation link is invalid.");

  const supabase = await createServerSupabaseClient();
  const userId = await verifiedUserId(supabase);
  if (!userId) return errorResult("Please sign in before accepting an invitation.");

  if (await getHouseholdForUser(supabase, userId)) return errorResult("You already belong to a household.");

  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .select("household_id")
    .eq("token", token)
    .maybeSingle();

  if (invitationError || !invitation) return errorResult("This invitation is no longer available.");

  const { error } = await supabase.from("household_members").insert({
    household_id: invitation.household_id,
    user_id: userId,
    role: "member",
  });

  if (isMembershipUniqueViolation(error)) return errorResult("You already belong to a household.");
  if (error) return errorResult("Unable to accept this invitation. Please try again.");

  redirect("/");
}
