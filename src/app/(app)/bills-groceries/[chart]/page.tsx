import { notFound } from "next/navigation";

import { BillsGroceriesChartDetail, type BillsGroceriesChartId } from "@/components/bills-groceries-dashboard";
import { WorkspaceShell } from "@/components/workspace-shell";
import { loadBillsGroceriesPage, type BillsGroceriesSearchParams } from "@/lib/bills-groceries-page";

const chartIds = new Set<BillsGroceriesChartId>(["bills", "yoy", "groceries", "daily"]);

export default async function BillsGroceriesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ chart: string }>;
  searchParams: Promise<BillsGroceriesSearchParams>;
}) {
  const [{ chart }, requested] = await Promise.all([params, searchParams]);
  if (!chartIds.has(chart as BillsGroceriesChartId)) notFound();

  const { data, selected } = await loadBillsGroceriesPage(requested);
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
