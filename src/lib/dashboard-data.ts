import { buildMonthlyReport, buildRangeReport } from "@/lib/financial-report";
import type { DateRange } from "@/lib/date-range";
import { getDashboardControls } from "@/lib/dashboard-read-model";
import { transactionFromRow } from "@/lib/finance-types";
import { getCurrentHouseholdContext } from "@/lib/household";

export async function getDashboardData(month: string, range?: DateRange) {
  const [household, controls] = await Promise.all([getCurrentHouseholdContext(), getDashboardControls()]);
  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");
  const { supabase } = household;
  const [householdResult, transactionsResult] = await Promise.all([
    supabase.from("households").select("opening_balance").eq("id", household.householdId).single(),
    supabase.from("transactions").select("*").eq("household_id", household.householdId).order("occurred_on", { ascending: false }),
  ]);
  if (householdResult.error || transactionsResult.error) throw new Error("Unable to load household data.");
  const transactions = (transactionsResult.data ?? []).map(transactionFromRow);
  const openingBalance = Number(householdResult.data.opening_balance);
  return {
    household,
    ...controls,
    transactions,
    report: range
      ? buildRangeReport({ openingBalance, categories: controls.categories, subcategories: controls.subcategories, transactions, ...range })
      : buildMonthlyReport({ openingBalance, categories: controls.categories, subcategories: controls.subcategories, transactions, month }),
  };
}
