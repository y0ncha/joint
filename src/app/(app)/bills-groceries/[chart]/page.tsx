import { notFound, redirect } from "next/navigation";

import { BillsGroceriesChartDetail, billsGroceriesChartIds, type BillsGroceriesChartId } from "@/components/bills-groceries-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { loadBillsGroceriesPage, type BillsGroceriesSearchParams } from "@/lib/bills-groceries-page";

export default async function BillsGroceriesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ chart: string }>;
  searchParams: Promise<BillsGroceriesSearchParams>;
}) {
  const [{ chart }, requested] = await Promise.all([params, searchParams]);
  if (!billsGroceriesChartIds.includes(chart as BillsGroceriesChartId)) notFound();

  const { canonical, data, params: requestedParams, selected } = await loadBillsGroceriesPage(requested);
  if (canonical.toString() !== requestedParams.toString()) redirect(`/bills-groceries/${chart}?${canonical}`);

  return (
    <WorkspaceShell opaqueContent>
      <BillsGroceriesChartDetail
        chart={chart as BillsGroceriesChartId}
        data={data}
        billIds={selected.billIds}
        billId={selected.billId}
        period={selected.period}
      />
    </WorkspaceShell>
  );
}
