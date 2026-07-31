import { BillsGroceriesDashboard } from "@/components/bills-groceries-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { loadBillsGroceriesPage } from "@/lib/bills-groceries-page";
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
  const { data, params, selected } = await loadBillsGroceriesPage(requested);
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
