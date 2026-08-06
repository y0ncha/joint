import { buildMonthlyReport, buildRangeReport } from "@/lib/financial-report";
import type { DateRange } from "@/lib/date-range";
import { categoryFromRow, subcategoryFromRow, transactionFromRow } from "@/lib/finance-types";
import { getCurrentHouseholdContext } from "@/lib/household";

export async function getDashboardData(month: string, range?: DateRange) {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");
  const { supabase } = household;
  const [householdResult, categoriesResult, subcategoriesResult, transactionsResult, membersResult] = await Promise.all([
    supabase.from("households").select("opening_balance").eq("id", household.householdId).single(),
    supabase.from("categories").select("*").eq("household_id", household.householdId).order("name"),
    supabase.from("subcategories").select("*").eq("household_id", household.householdId).order("name"),
    supabase.from("transactions").select("*").eq("household_id", household.householdId).order("occurred_on", { ascending: false }),
    supabase.from("household_members").select("user_id, role, color").eq("household_id", household.householdId).order("joined_at"),
  ]);
  if (householdResult.error || categoriesResult.error || subcategoriesResult.error || transactionsResult.error || membersResult.error)
    throw new Error("Unable to load household data.");
  const currentUserId = household.userId;
  const categories = (categoriesResult.data ?? []).map(categoryFromRow);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const subcategories = (subcategoriesResult.data ?? []).flatMap((row) => {
    const subcategory = subcategoryFromRow(row);
    const category = categoriesById.get(subcategory.categoryId);
    return category
      ? [
          {
            ...subcategory,
            categoryName: category.name,
            categorySystemKey: category.systemKey,
            kind: category.kind,
            color: subcategory.color,
            icon: subcategory.icon ?? category.icon,
            categoryArchivedAt: category.archivedAt,
          },
        ]
      : [];
  });
  const transactions = (transactionsResult.data ?? []).map(transactionFromRow);
  const members = (membersResult.data ?? []).map((member) => ({
    id: member.user_id,
    color: member.color,
    label: member.user_id === currentUserId ? "You" : member.role === "owner" ? "Owner" : "Partner",
  }));
  const openingBalance = Number(householdResult.data.opening_balance);
  return {
    household,
    currentUserId,
    members,
    categories,
    directCategories: categories.filter((category) => category.systemKey === "other_income" || category.systemKey === "other_expense"),
    subcategories,
    transactions,
    report: range
      ? buildRangeReport({ openingBalance, categories, subcategories, transactions, ...range })
      : buildMonthlyReport({ openingBalance, categories, subcategories, transactions, month }),
  };
}
