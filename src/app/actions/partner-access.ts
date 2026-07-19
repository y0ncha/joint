"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { partnerAccessSchema } from "@/lib/validation";

function ownerError(): ActionResult {
  return { status: "error", formError: "Only the household owner can manage partner access.", fieldErrors: {} };
}

export async function setAllowedPartnerEmail(input: FormData): Promise<ActionResult> {
  const parsed = partnerAccessSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  if (household.role !== "owner") return ownerError();

  const { data, error } = await household.supabase
    .from("household_allowed_members")
    .insert({ household_id: household.householdId, email: parsed.data.email })
    .select("household_id")
    .single();

  if (error?.code === "23505") return { status: "error", formError: "Partner access already exists. Remove it before authorizing another email.", fieldErrors: {} };
  if (error || data?.household_id !== household.householdId) return { status: "error", formError: "Unable to authorize partner access. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  return { status: "success" };
}

export async function removePartner(): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  if (household.role !== "owner") return ownerError();

  const { data: authorization, error } = await household.supabase
    .from("household_allowed_members")
    .delete()
    .eq("household_id", household.householdId)
    .select("household_id")
    .maybeSingle();

  if (error || authorization?.household_id !== household.householdId) {
    return { status: "error", formError: "Unable to remove partner access. Please refresh and try again.", fieldErrors: {} };
  }

  revalidatePath("/settings");
  return { status: "success" };
}
