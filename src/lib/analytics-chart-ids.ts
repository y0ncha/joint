export const analyticsChartIds = ["bills", "year-over-year", "groceries", "daily"] as const;
export type AnalyticsChartId = (typeof analyticsChartIds)[number];
