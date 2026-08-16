import { notFound, redirect } from "next/navigation";

import { AnalyticsChartDetail } from "@/components/analytics-dashboard";
import { analyticsChartIds, type AnalyticsChartId } from "@/lib/analytics-chart-ids";
import { WorkspacePage } from "@/components/workspace-shell";
import { loadAnalyticsPage, type AnalyticsSearchParams } from "@/lib/analytics-page";

export default async function AnalyticsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ chart: string }>;
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const [{ chart }, requested] = await Promise.all([params, searchParams]);
  if (!analyticsChartIds.includes(chart as AnalyticsChartId)) notFound();

  const { canonical, data, params: requestedParams, selected } = await loadAnalyticsPage(requested);
  if (canonical.toString() !== requestedParams.toString()) redirect(`/analytics/${chart}?${canonical}`);

  return (
    <WorkspacePage opaqueContent>
      <AnalyticsChartDetail
        chart={chart as AnalyticsChartId}
        data={data}
        billIds={selected.billIds}
        yoy={selected.yoy}
        period={selected.period}
      />
    </WorkspacePage>
  );
}
