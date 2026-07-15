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

export async function requireCurrentHousehold(): Promise<RequiredHousehold> {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) throw new Error("Please sign in before continuing.");

  const household = await getHouseholdForUser(supabase, userId);
  if (!household) throw new Error("Create or join a household before continuing.");

  return { ...household, userId };
}
