import { buildMonthlyReport } from "@/lib/financial-report";
import { accountFromRow, categoryFromRow, transactionFromRow } from "@/lib/finance-types";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getDashboardData(month: string) {
  const household = await getCurrentHousehold();
  if (!household) throw new Error("Create or join a household before viewing the dashboard.");
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const currentUserId = claims?.claims?.sub ?? "";
  const [accountsResult, categoriesResult, transactionsResult, membersResult] = await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", household.householdId).order("opening_balance_date"),
    supabase.from("categories").select("*").eq("household_id", household.householdId).order("name"),
    supabase.from("transactions").select("*").eq("household_id", household.householdId).order("occurred_on", { ascending: false }),
    supabase.from("household_members").select("user_id, role").eq("household_id", household.householdId).order("joined_at"),
  ]);
  if (accountsResult.error || categoriesResult.error || transactionsResult.error || membersResult.error) throw new Error("Unable to load household data.");
  const accounts = (accountsResult.data ?? []).map(accountFromRow);
  const categories = (categoriesResult.data ?? []).map(categoryFromRow);
  const transactions = (transactionsResult.data ?? []).map(transactionFromRow);
  const members = (membersResult.data ?? []).map((member) => ({
    id: member.user_id,
    label: member.user_id === currentUserId ? "You" : member.role === "owner" ? "Owner" : "Partner",
  }));
  return { household, currentUserId, members, accounts, categories, setupRequired: !accounts.some((account) => account.kind === "bank" && account.archivedAt === null), report: buildMonthlyReport({ accounts, categories, transactions, month }) };
}
