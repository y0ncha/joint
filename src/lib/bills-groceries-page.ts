import { parseBillsGroceriesUrlDefaults } from "@/lib/bills-groceries";
import { getBillsGroceriesData } from "@/lib/bills-groceries-data";

export type BillsGroceriesSearchParams = Record<string, string | undefined>;

export async function loadBillsGroceriesPage(searchParams: BillsGroceriesSearchParams) {
  const params = new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])));
  const currentDate = new Date().toISOString().slice(0, 10);
  const initial = parseBillsGroceriesUrlDefaults(params, { bills: [], defaultBillId: null, currentDate });
  const data = await getBillsGroceriesData({ currentDate, groceryRange: initial.groceryRange, period: initial.period });
  const selected = parseBillsGroceriesUrlDefaults(params, {
    bills: data.bills.subcategories,
    defaultBillId: data.bills.defaultSubcategoryId,
    currentDate,
  });

  return { data, params, selected };
}
