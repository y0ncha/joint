export const billsGroceriesChartIds = ["bills", "year-over-year", "groceries", "daily"] as const;
export type BillsGroceriesChartId = (typeof billsGroceriesChartIds)[number];
