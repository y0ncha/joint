import {
  allocateBillDaily,
  buildGroceriesDaily,
  buildGroceriesMonthly,
  buildMonthlyRange,
  consolidateBillsByMonth,
  pickDefaultBillSubcategory,
} from "@/lib/analytics";
import { buildGasTrend, type GasTrend } from "@/lib/gas-trend";
import { getIsoMonthRange, shiftIsoMonth } from "@/lib/date-range";
import { getCurrentHouseholdContext } from "@/lib/household";

type AnalyticsDataOptions = {
  currentDate: string;
  groceryRange: { from: string; to: string };
  period: "rolling" | "calendar";
};

function normalizedName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase("en");
}

function finiteAmount(value: number | string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Invalid monetary value from the database.");
  return amount;
}

async function readAllPages<Row>(
  loadPage: (from: number, to: number) => PromiseLike<{ count: number | null; data: Row[] | null; error: unknown }>,
) {
  const firstPage = await loadPage(0, 999);
  if (firstPage.error || firstPage.count === null || (firstPage.count > 0 && !firstPage.data?.length)) {
    throw new Error("Unable to load Analytics data.");
  }

  const rows = [...(firstPage.data ?? [])];
  while (rows.length < firstPage.count) {
    const page = await loadPage(rows.length, rows.length + 999);
    if (page.error || !page.data?.length) throw new Error("Unable to load Analytics data.");
    rows.push(...page.data);
  }

  return rows.slice(0, firstPage.count);
}

export async function getAnalyticsData(options: AnalyticsDataOptions) {
  const household = await getCurrentHouseholdContext();

  if (household.status !== "member") throw new Error("Create or join a household before viewing the dashboard.");

  const [billsCategoryResult, groceriesCategoryResult] = await Promise.all([
    household.supabase
      .from("categories")
      .select("id, name, color")
      .eq("household_id", household.householdId)
      .eq("system_key", "bills")
      .is("archived_at", null)
      .maybeSingle(),
    household.supabase
      .from("categories")
      .select("id, name, color, monthly_budget")
      .eq("household_id", household.householdId)
      .eq("system_key", "groceries")
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  if (billsCategoryResult.error || groceriesCategoryResult.error) {
    throw new Error("Unable to load Analytics data.");
  }

  const months = buildMonthlyRange(options.period, options.currentDate);
  const displayedRange = { from: `${months[0]}-01`, to: getIsoMonthRange(months[months.length - 1])!.to };
  const billsRange = { from: `${shiftIsoMonth(months[0], -12)}-01`, to: displayedRange.to };
  const [billSubcategoriesResult, grocerySubcategoriesResult, gasSubcategoriesResult] = await Promise.all([
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
    household.supabase.from("subcategories").select("id, name").eq("household_id", household.householdId).is("archived_at", null),
  ]);

  if (billSubcategoriesResult.error || grocerySubcategoriesResult.error || gasSubcategoriesResult.error) {
    throw new Error("Unable to load Analytics data.");
  }

  const billSubcategories = billSubcategoriesResult.data ?? [];
  const grocerySubcategories = grocerySubcategoriesResult.data ?? [];
  const gasSubcategories = new Map(
    (gasSubcategoriesResult.data ?? []).map((subcategory) => [normalizedName(subcategory.name), subcategory.id]),
  );
  const bikeGasId = gasSubcategories.get("bike gas") ?? gasSubcategories.get("bike fuel");
  const carGasId = gasSubcategories.get("car gas") ?? gasSubcategories.get("car fuel");
  const gasSubcategoryIds = [bikeGasId, carGasId].filter((id): id is string => id !== undefined);
  const groceryIds = grocerySubcategories.map((subcategory) => subcategory.id);
  let billTransactions;
  let groceryMonthlyTransactions;
  let groceryDailyTransactions;
  let gasTransactions;
  try {
    [billTransactions, groceryMonthlyTransactions, groceryDailyTransactions, gasTransactions] = await Promise.all([
      billSubcategories.length
        ? readAllPages((from, to) =>
            household.supabase
              .from("transactions")
              .select("amount, subcategory_id, service_period_start, service_period_end", { count: "exact" })
              .eq("household_id", household.householdId)
              .in(
                "subcategory_id",
                billSubcategories.map((subcategory) => subcategory.id),
              )
              .lte("service_period_start", billsRange.to)
              .gte("service_period_end", billsRange.from)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve([]),
      groceryIds.length
        ? readAllPages((from, to) =>
            household.supabase
              .from("transactions")
              .select("id, amount, occurred_on, subcategory_id", { count: "exact" })
              .eq("household_id", household.householdId)
              .in("subcategory_id", groceryIds)
              .gte("occurred_on", displayedRange.from)
              .lte("occurred_on", displayedRange.to)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve([]),
      groceryIds.length
        ? readAllPages((from, to) =>
            household.supabase
              .from("transactions")
              .select("id, amount, merchant, note, occurred_on, subcategory_id", { count: "exact" })
              .eq("household_id", household.householdId)
              .in("subcategory_id", groceryIds)
              .gte("occurred_on", options.groceryRange.from)
              .lte("occurred_on", options.groceryRange.to)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve([]),
      gasSubcategoryIds.length
        ? readAllPages((from, to) =>
            household.supabase
              .from("transactions")
              .select("amount, occurred_on, subcategory_id", { count: "exact" })
              .eq("household_id", household.householdId)
              .eq("kind", "expense")
              .in("subcategory_id", gasSubcategoryIds)
              .gte("occurred_on", billsRange.from)
              .lte("occurred_on", billsRange.to)
              .order("id")
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);
  } catch {
    throw new Error("Unable to load Analytics data.");
  }

  const monthlyBills = consolidateBillsByMonth(
    billTransactions.flatMap((transaction) =>
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
  const groceryInputs = (transactions: typeof groceryMonthlyTransactions) =>
    (transactions ?? []).flatMap((transaction) => {
      const subcategoryKey = transaction.subcategory_id ? groceryKeyById.get(transaction.subcategory_id) : undefined;
      return subcategoryKey ? [{ amount: transaction.amount, occurredOn: transaction.occurred_on, subcategoryKey }] : [];
    });
  const mainRun = grocerySubcategories.find((subcategory) => subcategory.system_key === "main_run");
  const topUps = grocerySubcategories.find((subcategory) => subcategory.system_key === "top_ups");
  const gas: GasTrend | null =
    gasSubcategoryIds.length === 0
      ? null
      : buildGasTrend(
          months,
          gasTransactions.flatMap<{ amount: number; kind: "bike" | "car"; occurredOn: string }>((transaction) => {
            if (bikeGasId && transaction.subcategory_id === bikeGasId) {
              return [{ amount: finiteAmount(transaction.amount), kind: "bike" as const, occurredOn: transaction.occurred_on }];
            }
            if (carGasId && transaction.subcategory_id === carGasId) {
              return [{ amount: finiteAmount(transaction.amount), kind: "car" as const, occurredOn: transaction.occurred_on }];
            }
            return [];
          }),
        );

  return {
    gas,
    months,
    bills: {
      category: billsCategoryResult.data,
      subcategories: billSubcategories,
      monthly: monthlyBills,
      defaultSubcategoryId,
    },
    groceries: {
      category: groceriesCategoryResult.data,
      subcategories: {
        mainRun: mainRun ? { id: mainRun.id, name: mainRun.name, color: mainRun.color } : null,
        topUps: topUps ? { id: topUps.id, name: topUps.name, color: topUps.color } : null,
      },
      monthly: buildGroceriesMonthly(
        months,
        groceryInputs(groceryMonthlyTransactions),
        groceriesCategoryResult.data?.monthly_budget ?? null,
      ),
      daily: buildGroceriesDaily(options.groceryRange, groceryInputs(groceryDailyTransactions)),
      transactions: (groceryDailyTransactions ?? []).flatMap((transaction) => {
        const subcategoryKey = transaction.subcategory_id ? groceryKeyById.get(transaction.subcategory_id) : undefined;
        return subcategoryKey
          ? [
              {
                id: transaction.id,
                amount: transaction.amount,
                merchant: transaction.merchant,
                note: transaction.note,
                occurredOn: transaction.occurred_on,
                subcategoryKey,
              },
            ]
          : [];
      }),
    },
  };
}
