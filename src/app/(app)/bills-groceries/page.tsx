import { BillsGroceriesDashboard } from "@/components/bills-groceries-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getBillsGroceriesData } from "@/lib/bills-groceries-data";
import { parseBillsGroceriesUrlDefaults } from "@/lib/bills-groceries";
import { redirect } from "next/navigation";

export default async function BillsGroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    bills?: string;
    bill?: string;
    groceryMonth?: string;
  }>;
}) {
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
  const canonical = new URLSearchParams(params);
  canonical.set("period", selected.period);
  canonical.set("bills", selected.billIds.join(","));
  if (selected.billId) canonical.set("bill", selected.billId);
  else canonical.delete("bill");

  canonical.set("groceryMonth", selected.groceryRange.from.slice(0, 7));
  canonical.delete("groceryFrom");
  canonical.delete("groceryTo");
  if (canonical.toString() !== params.toString()) redirect(`/bills-groceries?${canonical}`);

  return (
    <WorkspaceShell title="Bills & Groceries" description="Bills and groceries, without losing the daily detail.">
      <BillsGroceriesDashboard data={data} billIds={selected.billIds} billId={selected.billId} period={selected.period} />
    </WorkspaceShell>
  );
}
