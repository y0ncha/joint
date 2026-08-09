export type LedgerFilterKind = "all" | "income" | "expense";
export type LedgerSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export type LedgerFilterState = {
  categoryIds: string[];
  filterKind: LedgerFilterKind;
  paidByIds: string[];
  sort: LedgerSort;
};

type SearchParamsLike = {
  get(name: string): string | null;
  has(name: string): boolean;
};

export const defaultLedgerFilterState: LedgerFilterState = {
  categoryIds: [],
  filterKind: "all",
  paidByIds: [],
  sort: "date-desc",
};

function values(searchParams: SearchParamsLike, name: string, fallback: string[]) {
  return searchParams.has(name) ? (searchParams.get(name)?.split(",").filter(Boolean) ?? []) : fallback;
}

export function readLedgerFilterState(searchParams: SearchParamsLike, defaults: LedgerFilterState): LedgerFilterState {
  const filter = searchParams.get("filter");
  const sort = searchParams.get("sort");
  return {
    categoryIds: values(searchParams, "categories", defaults.categoryIds),
    filterKind: filter === "income" || filter === "expense" ? filter : defaults.filterKind,
    paidByIds: values(searchParams, "paidBy", defaults.paidByIds),
    sort: sort === "date-asc" || sort === "amount-desc" || sort === "amount-asc" ? sort : defaults.sort,
  };
}
