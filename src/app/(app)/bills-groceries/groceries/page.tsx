import { BillsGroceriesChartDetail } from "@/components/bills-groceries-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getBillsGroceriesData } from "@/lib/bills-groceries-data";
import { parseBillsGroceriesUrlDefaults } from "@/lib/bills-groceries";

export default async function GroceriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const requested = await searchParams;
  const params = new URLSearchParams(Object.entries(requested).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])));
  const currentDate = new Date().toISOString().slice(0, 10);
  const initial = parseBillsGroceriesUrlDefaults(params, { bills: [], defaultBillId: null, currentDate });
  const data = await getBillsGroceriesData({ currentDate, groceryRange: initial.groceryRange, period: initial.period });
  const selected = parseBillsGroceriesUrlDefaults(params, {
    bills: data.bills.subcategories,
    defaultBillId: data.bills.defaultSubcategoryId,
    currentDate,
  });

  return (
    <WorkspaceShell opaqueContent>
      <BillsGroceriesChartDetail
        chart="groceries"
        data={data}
        billIds={selected.billIds}
        billId={selected.billId}
        period={selected.period}
      />
    </WorkspaceShell>
  );
}
