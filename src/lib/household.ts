import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentHousehold = {
  householdId: string;
  role: "owner" | "member";
};

export async function getCurrentHousehold(): Promise<CurrentHousehold | null> {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (!userId) return null;

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
