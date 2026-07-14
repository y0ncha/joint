"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = {
  status: "error";
  formError: string;
  fieldErrors: Record<string, string>;
};

const householdName = z.string().trim().min(1, "Enter a household name.").max(80, "Use 80 characters or fewer.");

function errorResult(formError: string, fieldErrors: Record<string, string> = {}): ActionResult {
  return { status: "error", formError, fieldErrors };
}

function isMembershipUniqueViolation(error: { code?: string; message?: string; details?: string } | null) {
  return error?.code === "23505" && [error.message, error.details]
    .some((value) => value?.includes("household_members_user_id_key"));
}

async function verifiedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims?.sub ?? null;
}

export async function createHousehold(input: FormData): Promise<ActionResult> {
  const name = householdName.safeParse(input.get("name"));
  if (!name.success) {
    return errorResult("Check the household name.", { name: name.error.issues[0]?.message ?? "Invalid name." });
  }

  const userId = await verifiedUserId();
  if (!userId) return errorResult("Please sign in before creating a household.");

  if (await getCurrentHousehold()) {
    return errorResult("You already belong to a household.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("households")
    .insert({ name: name.data, created_by: userId })
    .select("id")
    .single();

  if (isMembershipUniqueViolation(error)) return errorResult("You already belong to a household.");
  if (error || !data) return errorResult("Unable to create your household. Please try again.");

  const household = await getCurrentHousehold();
  if (!household || household.householdId !== data.id || household.role !== "owner") {
    return errorResult("Unable to confirm your household membership. Please try again.");
  }

  redirect("/");
}

export async function acceptInvitation(input: FormData): Promise<ActionResult> {
  const token = input.get("token");
  if (typeof token !== "string" || !token) return errorResult("This invitation link is invalid.");

  const userId = await verifiedUserId();
  if (!userId) return errorResult("Please sign in before accepting an invitation.");

  if (await getCurrentHousehold()) return errorResult("You already belong to a household.");

  const supabase = await createServerSupabaseClient();
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
