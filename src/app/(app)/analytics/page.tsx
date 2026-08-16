import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { WorkspacePage } from "@/components/workspace-shell";
import { loadAnalyticsPage, type AnalyticsSearchParams } from "@/lib/analytics-page";
import { redirect } from "next/navigation";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const requested = await searchParams;
  const { canonical, data, params, selected } = await loadAnalyticsPage(requested);
  if (canonical.toString() !== params.toString()) redirect(`/analytics?${canonical}`);

  return (
    <WorkspacePage title="Analytics" description="Bills, groceries, and fuel without losing the daily detail.">
      <AnalyticsDashboard data={data} billIds={selected.billIds} yoy={selected.yoy} period={selected.period} />
    </WorkspacePage>
  );
}
