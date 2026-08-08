export type BillsGroceriesDataUrlKey = "period" | "groceryMonth";
export type BillsGroceriesPresentationUrlKey = "bills" | "bill" | "grocery";
export type BillsGroceriesUrlKey = BillsGroceriesDataUrlKey | BillsGroceriesPresentationUrlKey;
export type BillsGroceriesUrlUpdates = Partial<Record<BillsGroceriesUrlKey, string | null>>;
export type BillsGroceriesNavigationKind = "data" | "presentation";
export type GroceryPresentationFilter = "all" | "main-run" | "top-ups";

export function billsGroceriesNavigationKind(updates: BillsGroceriesUrlUpdates): BillsGroceriesNavigationKind {
  return "period" in updates || "groceryMonth" in updates ? "data" : "presentation";
}

export function buildBillsGroceriesUrl(pathname: string, searchParams: URLSearchParams, updates: BillsGroceriesUrlUpdates) {
  const params = new URLSearchParams(searchParams);
  for (const [name, value] of Object.entries(updates) as Array<[BillsGroceriesUrlKey, string | null]>) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function parseBillsGroceriesPresentationState(
  searchParams: URLSearchParams,
  options: {
    availableBillIds: string[];
    fallbackBillIds: string[];
    fallbackBillId: string | null;
  },
) {
  const requestedBillIds = searchParams.get("bills")?.split(",");
  const billIds =
    requestedBillIds?.length && requestedBillIds.every((id) => id !== "" && options.availableBillIds.includes(id))
      ? [...new Set(requestedBillIds)]
      : options.fallbackBillIds;
  const requestedBillId = searchParams.get("bill");
  const billId =
    (requestedBillId && options.availableBillIds.includes(requestedBillId) ? requestedBillId : null) ??
    options.fallbackBillId ??
    options.availableBillIds[0] ??
    "";
  const requestedGrocery = searchParams.get("grocery");
  const grocery: GroceryPresentationFilter = requestedGrocery === "main-run" || requestedGrocery === "top-ups" ? requestedGrocery : "all";
  return { billIds, billId, grocery };
}
