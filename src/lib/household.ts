import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentHousehold = {
  householdId: string;
  role: "owner" | "member";
};

export type RequiredHousehold = CurrentHousehold & {
  userId: string;
};

export type VerifiedPrincipal = {
  email: string;
  userId: string;
};

export type PartnerMembershipResult = "existing" | "joined" | "unmatched";

function isMembershipUniqueViolation(error: { code?: string; details?: string; message?: string }) {
  const constraints = ["household_members_user_id_key", "household_members_pkey"];
  return error.code === "23505" && [error.message, error.details]
    .some((value) => constraints.some((constraint) => value === constraint || value?.includes(`"${constraint}"`)));
}

export async function getHouseholdForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CurrentHousehold | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data
    ? { householdId: data.household_id, role: data.role }
    : null;
}

export async function getCurrentHousehold(): Promise<CurrentHousehold | null> {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) return null;

  return getHouseholdForUser(supabase, userId);
}

export async function ensurePartnerMembership(
  supabase: SupabaseClient<Database>,
  principal: VerifiedPrincipal,
): Promise<PartnerMembershipResult> {
  if (await getHouseholdForUser(supabase, principal.userId)) return "existing";

  const email = principal.email.trim().toLowerCase();
  if (!email) return "unmatched";

  const { data: authorization, error: authorizationError } = await supabase
    .from("household_allowed_members")
    .select("household_id")
    .eq("email", email)
    .maybeSingle();

  if (authorizationError) throw authorizationError;
  if (!authorization) return "unmatched";

  const { error } = await supabase.from("household_members").insert({
    household_id: authorization.household_id,
    user_id: principal.userId,
    role: "member",
  });

  if (!error) return "joined";

  if (error.code === "42501") {
    const { data: freshAuthorization, error: authorizationRecheckError } = await supabase
      .from("household_allowed_members")
      .select("household_id")
      .eq("email", email)
      .maybeSingle();

    if (authorizationRecheckError) throw authorizationRecheckError;
    if (!freshAuthorization) return "unmatched";
  }

  if (isMembershipUniqueViolation(error)) {
    const membership = await getHouseholdForUser(supabase, principal.userId);
    if (membership?.householdId === authorization.household_id && membership.role === "member") return "existing";
  }
  throw error;
}

export async function requireCurrentHousehold(): Promise<RequiredHousehold> {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) throw new Error("Please sign in before continuing.");

  const household = await getHouseholdForUser(supabase, userId);
  if (!household) throw new Error("This Google account does not have access to Joint.");

  return { ...household, userId };
}
