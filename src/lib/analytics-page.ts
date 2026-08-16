import { parseAnalyticsUrlDefaults } from "@/lib/analytics";
import { getAnalyticsData } from "@/lib/analytics-data";

export type AnalyticsSearchParams = Record<string, string | string[] | undefined>;

export function canonicalAnalyticsParams(
  params: URLSearchParams,
  selected: ReturnType<typeof parseAnalyticsUrlDefaults>,
  defaults: ReturnType<typeof parseAnalyticsUrlDefaults>,
) {
  const canonical = new URLSearchParams(params);
  if (selected.period === defaults.period) canonical.delete("period");
  else canonical.set("period", selected.period);
  const usesAllBills = selected.billIds.length === defaults.billIds.length && selected.billIds.every((id) => defaults.billIds.includes(id));
  if (usesAllBills) canonical.delete("bills");
  else canonical.set("bills", selected.billIds.join(","));
  if (selected.yoy === defaults.yoy) canonical.delete("yoy");
  else canonical.set("yoy", selected.yoy);
  canonical.delete("bill");
  if (selected.groceryRange.from === defaults.groceryRange.from) canonical.delete("groceryMonth");
  else canonical.set("groceryMonth", selected.groceryRange.from.slice(0, 7));
  canonical.delete("groceryFrom");
  canonical.delete("groceryTo");
  return canonical;
}

export async function loadAnalyticsPage(searchParams: AnalyticsSearchParams) {
  const params = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((entry) => [key, entry]),
    ),
  );
  const currentDate = new Date().toISOString().slice(0, 10);
  const initial = parseAnalyticsUrlDefaults(params, { bills: [], defaultBillId: null, currentDate });
  const data = await getAnalyticsData({ currentDate, groceryRange: initial.groceryRange, period: initial.period });
  const options = {
    bills: data.bills.subcategories,
    defaultBillId: data.bills.defaultSubcategoryId,
    currentDate,
  };
  const selected = parseAnalyticsUrlDefaults(params, options);
  const defaults = parseAnalyticsUrlDefaults(new URLSearchParams(), options);
  const canonical = canonicalAnalyticsParams(params, selected, defaults);

  return { canonical, data, params, selected };
}
