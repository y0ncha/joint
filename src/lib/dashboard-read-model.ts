import { cache } from "react";

import { getIsoMonthRange, type DateRange } from "@/lib/date-range";
import { getCurrentHouseholdContext } from "@/lib/household";
import type { LedgerFilterKind, LedgerSort } from "@/lib/ledger-filters";

type DashboardReadOptions = {
  month: string;
  range?: DateRange;
  spendingCategoryId?: string;
  spendingCategoryIds?: string[];
  spendingGranularity?: "categories" | "subcategories";
};

function money(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Invalid monetary value from the database.");
  return amount;
}

async function memberContext() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");
  return household;
}

function rpcArgs({ month, range }: DashboardReadOptions) {
  return { p_month: `${month}-01`, p_range_from: range?.from ?? null, p_range_to: range?.to ?? null };
}

export const getDashboardControls = cache(async () => {
  const household = await memberContext();
  const [categoriesResult, subcategoriesResult, membersResult] = await Promise.all([
    household.supabase
      .from("categories")
      .select("id, name, kind, system_key, archived_at, color, icon")
      .eq("household_id", household.householdId)
      .order("name"),
    household.supabase
      .from("subcategories")
      .select("id, name, category_id, system_key, archived_at, color, icon")
      .eq("household_id", household.householdId)
      .order("name"),
    household.supabase
      .from("household_members")
      .select("user_id, color, profiles(full_name)")
      .eq("household_id", household.householdId)
      .order("joined_at"),
  ]);
  if (categoriesResult.error || subcategoriesResult.error || membersResult.error) {
    throw new Error("Unable to load household data.");
  }

  const categories = (categoriesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    systemKey: row.system_key,
    archivedAt: row.archived_at,
    color: row.color,
    icon: row.icon,
  }));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const subcategories = (subcategoriesResult.data ?? []).flatMap((row) => {
    const category = categoriesById.get(row.category_id);
    return category
      ? [
          {
            id: row.id,
            name: row.name,
            categoryId: row.category_id,
            systemKey: row.system_key,
            archivedAt: row.archived_at,
            categoryName: category.name,
            categorySystemKey: category.systemKey,
            kind: category.kind,
            color: row.color,
            icon: row.icon ?? category.icon,
            categoryArchivedAt: category.archivedAt,
          },
        ]
      : [];
  });

  return {
    currentUserId: household.userId,
    members: (membersResult.data ?? []).map((member) => ({
      id: member.user_id,
      color: member.color,
      label: member.profiles?.full_name?.trim() || "Unnamed member",
    })),
    categories,
    directCategories: categories.filter((category) => category.systemKey === "other_income" || category.systemKey === "other_expense"),
    subcategories,
  };
});

export async function getDashboardSummary(options: DashboardReadOptions) {
  const household = await memberContext();
  const { data, error } = await household.supabase.rpc("dashboard_summary", rpcArgs(options));
  const row = data?.[0];
  if (error || !row) throw new Error("Unable to load dashboard summary.");
  return {
    income: money(row.income),
    expenses: money(row.expenses),
    incomeChangePercentage: row.income_change_percentage === null ? null : Number(row.income_change_percentage),
    expenseChangePercentage: row.expense_change_percentage === null ? null : Number(row.expense_change_percentage),
  };
}

export async function getDashboardSpending(options: DashboardReadOptions) {
  const household = await memberContext();
  const { data, error } = await household.supabase.rpc("dashboard_spending", {
    ...rpcArgs(options),
    p_category_id: options.spendingCategoryId ?? null,
  });
  if (error) throw new Error("Unable to load dashboard spending.");
  return {
    categoryTotals: (data ?? []).map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      amount: money(row.amount),
    })),
  };
}

export async function getDashboardBalance(options: DashboardReadOptions) {
  const household = await memberContext();
  const { data, error } = await household.supabase.rpc("dashboard_balance", rpcArgs(options));
  const row = data?.[0];
  if (error || !row) throw new Error("Unable to load dashboard balance.");
  return {
    sharedBalance: money(row.shared_balance),
    expectedMonthlyIncome: row.expected_monthly_income === null ? null : money(row.expected_monthly_income),
    expenses: money(row.expenses),
  };
}

export async function getDashboardRecentActivity(options: DashboardReadOptions) {
  const household = await memberContext();
  const { data, error } = await household.supabase.rpc("dashboard_recent_activity", rpcArgs(options));
  if (error) throw new Error("Unable to load dashboard activity.");
  return {
    transactions: (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: money(row.amount),
      occurredOn: row.occurred_on,
      merchant: row.merchant,
      note: row.note,
      source: row.source,
      categoryName: row.category_name,
      subcategoryName: row.subcategory_name,
    })),
  };
}

export async function getLedgerData({
  month,
  range,
  categoryIds: requestedCategoryIds = [],
  paidByIds: requestedPaidByIds = [],
  filterKind = "all",
  sort = "date-desc",
}: DashboardReadOptions & {
  categoryIds?: string[];
  filterKind?: LedgerFilterKind;
  paidByIds?: string[];
  sort?: LedgerSort;
}) {
  const [household, controls] = await Promise.all([memberContext(), getDashboardControls()]);
  const ledgerRange = range ?? getIsoMonthRange(month);
  if (!ledgerRange) throw new Error("Invalid ledger month.");

  const validCategoryIds = new Set([...controls.categories.map((category) => category.id), "uncategorized"]);
  const selectedCategoryIds = requestedCategoryIds.filter((id) => validCategoryIds.has(id));
  const categoryIds = selectedCategoryIds.length
    ? selectedCategoryIds
    : [...controls.categories.map((category) => category.id), "uncategorized"];
  const validPaidByIds = new Set([...controls.members.map((member) => member.id), "unassigned"]);
  const paidByIds = requestedPaidByIds.filter((id) => validPaidByIds.has(id));

  const transactionsQuery = household.supabase
    .from("transactions")
    .select(
      "id, kind, amount, occurred_on, merchant, note, category_id, subcategory_id, service_period_start, service_period_end, source, created_at, paid_by",
    )
    .eq("household_id", household.householdId)
    .gte("occurred_on", ledgerRange.from)
    .lte("occurred_on", ledgerRange.to);

  if (filterKind !== "all") transactionsQuery.eq("kind", filterKind);
  if (selectedCategoryIds.length) {
    const directIds = selectedCategoryIds.filter((id) => id !== "uncategorized");
    const subcategoryIds = controls.subcategories
      .filter((subcategory) => directIds.includes(subcategory.categoryId))
      .map((subcategory) => subcategory.id);
    const filters = [
      directIds.length ? `category_id.in.(${directIds.join(",")})` : "",
      subcategoryIds.length ? `subcategory_id.in.(${subcategoryIds.join(",")})` : "",
      selectedCategoryIds.includes("uncategorized") ? "and(category_id.is.null,subcategory_id.is.null)" : "",
    ].filter(Boolean);
    transactionsQuery.or(filters.join(","));
  }
  if (paidByIds.length) {
    const memberIds = paidByIds.filter((id) => id !== "unassigned");
    if (memberIds.length && paidByIds.includes("unassigned")) {
      transactionsQuery.or(`paid_by.in.(${memberIds.join(",")}),paid_by.is.null`);
    } else if (memberIds.length) {
      transactionsQuery.in("paid_by", memberIds);
    } else {
      transactionsQuery.is("paid_by", null);
    }
  }

  if (sort === "amount-desc" || sort === "amount-asc") {
    transactionsQuery.order("amount", { ascending: sort === "amount-asc" });
    transactionsQuery.order("occurred_on", { ascending: false });
  } else {
    transactionsQuery.order("occurred_on", { ascending: sort === "date-asc" });
  }
  transactionsQuery.order("created_at", { ascending: sort === "date-asc" });

  const schedulesQuery = household.supabase
    .from("recurring_transaction_schedules")
    .select("id, amount, cadence, enabled, merchant, next_occurs_on, note, interval_count")
    .eq("household_id", household.householdId)
    .order("next_occurs_on");
  const [transactionsResult, schedulesResult] = await Promise.all([transactionsQuery, schedulesQuery]);
  if (transactionsResult.error || schedulesResult.error) throw new Error("Unable to load ledger data.");

  return {
    ...controls,
    categoryIds,
    paidByIds,
    schedules: schedulesResult.data ?? [],
    transactions: (transactionsResult.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: money(row.amount),
      occurredOn: row.occurred_on,
      merchant: row.merchant,
      note: row.note,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      servicePeriodStart: row.service_period_start,
      servicePeriodEnd: row.service_period_end,
      source: row.source,
      createdAt: row.created_at,
      paidBy: row.paid_by,
    })),
  };
}
