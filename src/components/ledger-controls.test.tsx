import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { getNextLedgerFilterKind, LedgerControls } = await import("./ledger-controls");

it("keeps at least one transaction type selected", () => {
  expect(getNextLedgerFilterKind("all", "income")).toBe("expense");
  expect(getNextLedgerFilterKind("expense", "income")).toBe("all");
  expect(getNextLedgerFilterKind("income", "income")).toBe("income");
});

it("renders the type filter as a multiselect and Sort by control", () => {
  const markup = renderToStaticMarkup(
    <LedgerControls
      categories={[]}
      categoryIds={[]}
      filterKind="expense"
      importRequested={false}
      members={[]}
      month="2026-07"
      paidByIds={[]}
      sort="amount-asc"
    />,
  );

  expect(markup).toContain("Type");
  expect(markup).toContain('aria-label="Filter transaction types"');
  expect(markup).toContain('id="ledger-type-income"');
  expect(markup).toContain('id="ledger-type-expense"');
  for (const id of ["ledger-type-income", "ledger-category-uncategorized", "ledger-member-unassigned"]) {
    const control = markup.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0];
    expect(control).toContain("size-3");
    expect(control).toContain("min-h-11");
  }
  expect(markup).toContain("bg-negative/10");
  expect(markup).toContain("bg-positive/10");
  expect(markup).toContain('aria-label="Filter payers"');
  expect(markup).not.toContain('aria-label="Search payers"');
  expect(markup).toContain("Sort by");
  expect(markup).toContain('aria-label="Sort by"');
  expect(markup.match(/<button[^>]*id="ledger-sort"[^>]*>/)?.[0]).toContain("min-h-11");
  expect(markup).toContain('data-variant="default"');
});

it("renders selected category filters as colored pills in a searchable multiselect", () => {
  const markup = renderToStaticMarkup(
    <LedgerControls
      categories={[{ id: "groceries", name: "Groceries", color: "#B7E4C7" }]}
      categoryIds={["groceries"]}
      filterKind="all"
      importRequested={false}
      members={[]}
      month="2026-07"
      paidByIds={[]}
      sort="date-desc"
    />,
  );

  expect(markup).toContain('aria-label="Filter categories"');
  expect(markup).toContain('aria-label="Search categories"');
  expect(markup).toContain('name="category-search"');
  expect(markup).toContain('autoComplete="off"');
  expect(markup).toContain("background-color:#B7E4C7");
});

it("summarizes an all-category selection", () => {
  const markup = renderToStaticMarkup(
    <LedgerControls
      categories={[{ id: "groceries", name: "Groceries", color: "#B7E4C7" }]}
      categoryIds={["groceries", "uncategorized"]}
      filterKind="all"
      importRequested={false}
      members={[]}
      month="2026-07"
      paidByIds={[]}
      sort="date-desc"
    />,
  );

  expect(markup).toContain("All categories");
});
