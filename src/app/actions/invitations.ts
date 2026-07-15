"use server";

import { headers } from "next/headers";

import type { ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { invitationSchema } from "@/lib/validation";

export async function createInvitation(input: FormData): Promise<ActionResult> {
  const parsed = invitationSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return { status: "error", formError: "Check the invitation email.", fieldErrors: { email: parsed.error.issues[0]?.message ?? "Invalid email." } };
  const household = await requireCurrentHousehold();
  if (household.role !== "owner") return { status: "error", formError: "Only the household owner can create an invite.", fieldErrors: {} };
  const { data, error } = await (await createServerSupabaseClient()).from("invitations").insert({
    household_id: household.householdId,
    invited_by: household.userId,
    email: parsed.data.email,
  }).select("token").single();
  if (error || !data) return { status: "error", formError: "Unable to create the invitation. Please try again.", fieldErrors: {} };
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host") ?? "localhost:3000"}`;
  return { status: "success", data: { invitationUrl: new URL(`/invite/${data.token}`, origin).toString() } };
}
