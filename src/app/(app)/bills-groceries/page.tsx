import { BillsGroceriesDashboard } from "@/components/bills-groceries-dashboard";
import { WorkspacePage } from "@/components/workspace-shell";
import { loadBillsGroceriesPage, type BillsGroceriesSearchParams } from "@/lib/bills-groceries-page";
import { redirect } from "next/navigation";

export default async function BillsGroceriesPage({ searchParams }: { searchParams: Promise<BillsGroceriesSearchParams> }) {
  const requested = await searchParams;
  const { canonical, data, params, selected } = await loadBillsGroceriesPage(requested);
  if (canonical.toString() !== params.toString()) redirect(`/bills-groceries?${canonical}`);

  return (
    <WorkspacePage title="Bills & Groceries" description="Bills and groceries, without losing the daily detail.">
      <BillsGroceriesDashboard data={data} billIds={selected.billIds} billId={selected.billId} period={selected.period} />
    </WorkspacePage>
  );
}
