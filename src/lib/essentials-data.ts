import {
  alignBillYearOverYear,
  allocateBillDaily,
  buildGroceriesDaily,
  buildGroceriesMonthly,
  buildMonthlyRange,
  consolidateBillsByMonth,
  pickDefaultBillSubcategory,
} from "@/lib/essentials";
import { getCurrentHouseholdContext } from "@/lib/household";

type EssentialsDataOptions = {
  currentDate: string;
  groceryRange: { from: string; to: string };
  period: "rolling" | "calendar";
};

function monthEnd(month: string) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function previousYearMonth(month: string) {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
}

export async function getEssentialsData(options: EssentialsDataOptions) {
  const household = await getCurrentHouseholdContext();

  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");

  const [budgetResult, billsCategoryResult, groceriesCategoryResult] = await Promise.all([
    household.supabase.from("households").select("groceries_monthly_budget").eq("id", household.householdId).maybeSingle(),
    household.supabase
      .from("categories")
      .select("id, name, color")
      .eq("household_id", household.householdId)
      .eq("system_key", "bills")
      .is("archived_at", null)
      .maybeSingle(),
    household.supabase
      .from("categories")
      .select("id, name, color")
      .eq("household_id", household.householdId)
      .eq("system_key", "groceries")
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  if (budgetResult.error || billsCategoryResult.error || groceriesCategoryResult.error) {
    throw new Error("Unable to load Essentials data.");
  }

  const months = buildMonthlyRange(options.period, options.currentDate);
  const displayedRange = { from: `${months[0]}-01`, to: monthEnd(months[months.length - 1]) };
  const billsRange = { from: `${previousYearMonth(months[0])}-01`, to: displayedRange.to };
  const [billSubcategoriesResult, grocerySubcategoriesResult] = await Promise.all([
    billsCategoryResult.data
      ? household.supabase
          .from("subcategories")
          .select("id, name, color")
          .eq("household_id", household.householdId)
          .eq("category_id", billsCategoryResult.data.id)
          .is("archived_at", null)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    groceriesCategoryResult.data
      ? household.supabase
          .from("subcategories")
          .select("id, name, color, system_key")
          .eq("household_id", household.householdId)
          .eq("category_id", groceriesCategoryResult.data.id)
          .in("system_key", ["main_run", "top_ups"])
          .is("archived_at", null)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (billSubcategoriesResult.error || grocerySubcategoriesResult.error) {
    throw new Error("Unable to load Essentials data.");
  }

  const billSubcategories = billSubcategoriesResult.data ?? [];
  const grocerySubcategories = grocerySubcategoriesResult.data ?? [];
  const groceryIds = grocerySubcategories.map((subcategory) => subcategory.id);
  const [billTransactionsResult, groceryMonthlyTransactionsResult, groceryDailyTransactionsResult] = await Promise.all([
    billSubcategories.length
      ? household.supabase
          .from("transactions")
          .select("amount, subcategory_id, service_period_start, service_period_end")
          .eq("household_id", household.householdId)
          .in(
            "subcategory_id",
            billSubcategories.map((subcategory) => subcategory.id),
          )
          .lte("service_period_start", billsRange.to)
          .gte("service_period_end", billsRange.from)
      : Promise.resolve({ data: [], error: null }),
    groceryIds.length
      ? household.supabase
          .from("transactions")
          .select("amount, occurred_on, subcategory_id")
          .eq("household_id", household.householdId)
          .in("subcategory_id", groceryIds)
          .gte("occurred_on", displayedRange.from)
          .lte("occurred_on", displayedRange.to)
      : Promise.resolve({ data: [], error: null }),
    groceryIds.length
      ? household.supabase
          .from("transactions")
          .select("amount, occurred_on, subcategory_id")
          .eq("household_id", household.householdId)
          .in("subcategory_id", groceryIds)
          .gte("occurred_on", options.groceryRange.from)
          .lte("occurred_on", options.groceryRange.to)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (billTransactionsResult.error || groceryMonthlyTransactionsResult.error || groceryDailyTransactionsResult.error) {
    throw new Error("Unable to load Essentials data.");
  }

  const monthlyBills = consolidateBillsByMonth(
    (billTransactionsResult.data ?? []).flatMap((transaction) =>
      transaction.subcategory_id && transaction.service_period_start && transaction.service_period_end
        ? allocateBillDaily(
            {
              amount: transaction.amount,
              subcategoryId: transaction.subcategory_id,
              servicePeriodStart: transaction.service_period_start,
              servicePeriodEnd: transaction.service_period_end,
            },
            billsRange,
          )
        : [],
    ),
  );
  const defaultSubcategoryId = pickDefaultBillSubcategory(months, billSubcategories, monthlyBills);
  const groceryKeyById = new Map(
    grocerySubcategories.flatMap((subcategory) =>
      subcategory.system_key === "main_run" || subcategory.system_key === "top_ups"
        ? [[subcategory.id, subcategory.system_key] as const]
        : [],
    ),
  );
  const groceryInputs = (transactions: typeof groceryMonthlyTransactionsResult.data) =>
    (transactions ?? []).flatMap((transaction) => {
      const subcategoryKey = transaction.subcategory_id ? groceryKeyById.get(transaction.subcategory_id) : undefined;
      return subcategoryKey ? [{ amount: transaction.amount, occurredOn: transaction.occurred_on, subcategoryKey }] : [];
    });
  const mainRun = grocerySubcategories.find((subcategory) => subcategory.system_key === "main_run");
  const topUps = grocerySubcategories.find((subcategory) => subcategory.system_key === "top_ups");

  return {
    months,
    bills: {
      category: billsCategoryResult.data,
      subcategories: billSubcategories,
      monthly: monthlyBills,
      defaultSubcategoryId,
      yearOverYear: defaultSubcategoryId ? alignBillYearOverYear(months, monthlyBills, defaultSubcategoryId) : [],
    },
    groceries: {
      category: groceriesCategoryResult.data,
      subcategories: {
        mainRun: mainRun ? { id: mainRun.id, name: mainRun.name, color: mainRun.color } : null,
        topUps: topUps ? { id: topUps.id, name: topUps.name, color: topUps.color } : null,
      },
      monthly: buildGroceriesMonthly(
        months,
        groceryInputs(groceryMonthlyTransactionsResult.data),
        budgetResult.data?.groceries_monthly_budget ?? null,
      ),
      daily: buildGroceriesDaily(options.groceryRange, groceryInputs(groceryDailyTransactionsResult.data)),
    },
  };
}
