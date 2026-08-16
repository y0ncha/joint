import { parseBillsGroceriesUrlDefaults } from "@/lib/bills-groceries";
import { getBillsGroceriesData } from "@/lib/bills-groceries-data";

export type BillsGroceriesSearchParams = Record<string, string | string[] | undefined>;

export function canonicalBillsGroceriesParams(
  params: URLSearchParams,
  selected: ReturnType<typeof parseBillsGroceriesUrlDefaults>,
  defaults: ReturnType<typeof parseBillsGroceriesUrlDefaults>,
) {
  const canonical = new URLSearchParams(params);
  if (selected.period === defaults.period) canonical.delete("period");
  else canonical.set("period", selected.period);
  const usesAllBills = selected.billIds.length === defaults.billIds.length && selected.billIds.every((id) => defaults.billIds.includes(id));
  if (usesAllBills) canonical.delete("bills");
  else canonical.set("bills", selected.billIds.join(","));
  if (selected.billId === defaults.billId) canonical.delete("bill");
  else if (selected.billId) canonical.set("bill", selected.billId);
  else canonical.delete("bill");
  if (selected.groceryRange.from === defaults.groceryRange.from) canonical.delete("groceryMonth");
  else canonical.set("groceryMonth", selected.groceryRange.from.slice(0, 7));
  canonical.delete("groceryFrom");
  canonical.delete("groceryTo");
  return canonical;
}

export async function loadBillsGroceriesPage(searchParams: BillsGroceriesSearchParams) {
  const params = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((entry) => [key, entry]),
    ),
  );
  const currentDate = new Date().toISOString().slice(0, 10);
  const initial = parseBillsGroceriesUrlDefaults(params, { bills: [], defaultBillId: null, currentDate });
  const data = await getBillsGroceriesData({ currentDate, groceryRange: initial.groceryRange, period: initial.period });
  const options = {
    bills: data.bills.subcategories,
    defaultBillId: data.bills.defaultSubcategoryId,
    currentDate,
  };
  const selected = parseBillsGroceriesUrlDefaults(params, options);
  const defaults = parseBillsGroceriesUrlDefaults(new URLSearchParams(), options);
  const canonical = canonicalBillsGroceriesParams(params, selected, defaults);

  return { canonical, data, params, selected };
}
