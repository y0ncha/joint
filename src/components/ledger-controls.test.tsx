import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

import { defaultLedgerFilterState, readLedgerFilterState } from "@/lib/ledger-filters";

const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  enabled: false,
  state: [] as unknown[],
  stateIndex: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void), dependencies: readonly unknown[]) => {
      if (!hooks.enabled) return actual.useEffect(effect, dependencies);
      hooks.effects.push(effect);
    },
    useState: (initialState: unknown | (() => unknown)) => {
      if (!hooks.enabled) return actual.useState(initialState);
      const index = hooks.stateIndex++;
      if (!(index in hooks.state)) hooks.state[index] = typeof initialState === "function" ? initialState() : initialState;
      return [
        hooks.state[index],
        (nextState: unknown | ((current: unknown) => unknown)) => {
          hooks.state[index] = typeof nextState === "function" ? nextState(hooks.state[index]) : nextState;
        },
      ];
    },
  };
});

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

afterEach(() => {
  hooks.effects = [];
  hooks.enabled = false;
  hooks.state = [];
  hooks.stateIndex = 0;
  vi.unstubAllGlobals();
});

function renderWithEffects(props: React.ComponentProps<typeof LedgerControls>) {
  hooks.enabled = true;
  hooks.stateIndex = 0;
  hooks.effects = [];
  const markup = renderToStaticMarkup(<LedgerControls {...props} />);
  return { effect: hooks.effects[0]!, markup };
}

function categorySummary(markup: string) {
  return markup.match(/<button(?=[^>]*aria-label="Filter categories")[\s\S]*?<\/button>/)?.[0] ?? "";
}

it("preserves server-provided filters when hydration registers URL listeners", () => {
  vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { search: "" } }));
  const props = {
    categories: [{ id: "groceries", name: "Groceries", color: "#B7E4C7" }],
    categoryIds: ["groceries"],
    filterKind: "expense" as const,
    importRequested: false,
    members: [],
    month: "2026-07",
    paidByIds: [],
    sort: "date-desc" as const,
  };

  const { effect } = renderWithEffects(props);
  const cleanup = effect();
  const { markup } = renderWithEffects(props);

  expect(markup).toContain("Expenses");
  expect(categorySummary(markup)).toContain("Groceries");
  cleanup?.();
});

it("shows all categories after a URL event clears category parameters", () => {
  const eventTarget = Object.assign(new EventTarget(), { location: { search: "" } });
  vi.stubGlobal("window", eventTarget);
  const props = {
    categories: [{ id: "groceries", name: "Groceries", color: "#B7E4C7" }],
    categoryIds: ["groceries", "uncategorized"],
    filterKind: "all" as const,
    importRequested: false,
    members: [],
    month: "2026-07",
    paidByIds: [],
    sort: "date-desc" as const,
  };

  const { effect } = renderWithEffects(props);
  const cleanup = effect();
  eventTarget.dispatchEvent(new Event("ledger-filter-change"));
  const summary = categorySummary(renderWithEffects(props).markup);

  expect(summary).toContain("All categories");
  expect(summary).not.toContain("Uncategorized");
  cleanup?.();
});

it("resets removed URL filter parameters to the canonical ledger defaults", () => {
  expect(readLedgerFilterState(new URLSearchParams("month=2026-07"), defaultLedgerFilterState)).toEqual(defaultLedgerFilterState);
});

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
    expect(control).toContain("size-4");
    expect(control).not.toContain("min-h-11");
  }
  expect(markup).toContain("bg-negative/10");
  expect(markup).toContain("bg-positive/10");
  expect(markup).toContain('aria-label="Filter payers"');
  expect(markup).not.toContain('aria-label="Search payers"');
  expect(markup).toContain("Sort by");
  expect(markup).toContain('aria-label="Sort by"');
  expect(markup.match(/<button[^>]*id="ledger-sort"[^>]*>/)?.[0]).toContain("h-11");
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
