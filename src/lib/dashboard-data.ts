import { buildMonthlyReport } from "@/lib/financial-report";
import { categoryFromRow, transactionFromRow } from "@/lib/finance-types";
import { getCurrentHouseholdContext } from "@/lib/household";

export async function getDashboardData(month: string) {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");
  const { supabase } = household;
  const [householdResult, categoriesResult, transactionsResult, membersResult] = await Promise.all([
    supabase.from("households").select("opening_balance").eq("id", household.householdId).single(),
    supabase.from("categories").select("*").eq("household_id", household.householdId).order("name"),
    supabase.from("transactions").select("*").eq("household_id", household.householdId).order("occurred_on", { ascending: false }),
    supabase.from("household_members").select("user_id, role").eq("household_id", household.householdId).order("joined_at"),
  ]);
  if (householdResult.error || categoriesResult.error || transactionsResult.error || membersResult.error) throw new Error("Unable to load household data.");
  const currentUserId = household.userId;
  const categories = (categoriesResult.data ?? []).map(categoryFromRow);
  const transactions = (transactionsResult.data ?? []).map(transactionFromRow);
  const members = (membersResult.data ?? []).map((member) => ({
    id: member.user_id,
    label: member.user_id === currentUserId ? "You" : member.role === "owner" ? "Owner" : "Partner",
  }));
  return { household, currentUserId, members, categories, report: buildMonthlyReport({ openingBalance: Number(householdResult.data.opening_balance), categories, transactions, month }) };
}
