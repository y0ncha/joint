export type AnalyticsDataUrlKey = "period" | "groceryMonth";
export type AnalyticsPresentationUrlKey = "bills" | "yoy" | "grocery";
export type AnalyticsUrlKey = AnalyticsDataUrlKey | AnalyticsPresentationUrlKey;
export type AnalyticsUrlUpdates = Partial<Record<AnalyticsUrlKey, string | null>>;
export type AnalyticsNavigationKind = "data" | "presentation";
export type GroceryPresentationFilter = "all" | "main-run" | "top-ups";

export function analyticsNavigationKind(updates: AnalyticsUrlUpdates): AnalyticsNavigationKind {
  return "period" in updates || "groceryMonth" in updates ? "data" : "presentation";
}

export function buildAnalyticsUrl(pathname: string, searchParams: URLSearchParams, updates: AnalyticsUrlUpdates) {
  const params = new URLSearchParams(searchParams);
  for (const [name, value] of Object.entries(updates) as Array<[AnalyticsUrlKey, string | null]>) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function parseAnalyticsPresentationState(
  searchParams: URLSearchParams,
  options: {
    availableBillIds: string[];
    fallbackBillIds: string[];
    fallbackYoy: string;
  },
) {
  const requestedBillIds = searchParams.get("bills")?.split(",");
  const billIds =
    requestedBillIds?.length && requestedBillIds.every((id) => id !== "" && options.availableBillIds.includes(id))
      ? [...new Set(requestedBillIds)]
      : options.fallbackBillIds;
  const requestedYoy = searchParams.get("yoy");
  const yoy =
    requestedYoy === "gas" || (requestedYoy !== null && options.availableBillIds.includes(requestedYoy))
      ? requestedYoy
      : options.fallbackYoy;
  const requestedGrocery = searchParams.get("grocery");
  const grocery: GroceryPresentationFilter = requestedGrocery === "main-run" || requestedGrocery === "top-ups" ? requestedGrocery : "all";
  return { billIds, yoy, grocery };
}
