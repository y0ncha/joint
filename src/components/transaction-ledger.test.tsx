import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

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
  useSearchParams: () => mocks.searchParams,
}));

import { getLedgerShortcutAction, TransactionLedger } from "./transaction-ledger";

type ImportedLedgerTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  subcategoryId: null;
  note: string;
  merchant: string;
  source: "statement_import";
  createdAt: string;
  paidBy: null;
};

afterEach(() => {
  mocks.searchParams = new URLSearchParams();
  hooks.effects = [];
  hooks.enabled = false;
  hooks.state = [];
  hooks.stateIndex = 0;
  vi.unstubAllGlobals();
});

it("keeps server filters through hydration, then defaults cleared URL filters on popstate", () => {
  const eventTarget = Object.assign(new EventTarget(), { location: { search: "" } });
  vi.stubGlobal("window", eventTarget);
  hooks.enabled = true;
  const props = {
    filterKind: "income" as const,
    members: [],
    transactions: [
      {
        id: "income",
        kind: "income" as const,
        amount: 100,
        occurredOn: "2026-07-15",
        subcategoryId: null,
        note: "Server income",
        createdAt: "2026-07-15T08:00:00Z",
        paidBy: null,
      },
      {
        id: "expense",
        kind: "expense" as const,
        amount: 50,
        occurredOn: "2026-07-14",
        subcategoryId: null,
        note: "Default expense",
        createdAt: "2026-07-14T08:00:00Z",
        paidBy: null,
      },
    ],
  };

  hooks.stateIndex = 0;
  hooks.effects = [];
  renderToStaticMarkup(<TransactionLedger {...props} />);
  const cleanup = hooks.effects[0]!();
  hooks.stateIndex = 0;
  hooks.effects = [];
  const hydratedMarkup = renderToStaticMarkup(<TransactionLedger {...props} />);

  expect(hydratedMarkup).toContain("Server income");
  expect(hydratedMarkup).not.toContain("Default expense");

  eventTarget.dispatchEvent(new Event("popstate"));
  hooks.stateIndex = 0;
  hooks.effects = [];
  const clearedMarkup = renderToStaticMarkup(<TransactionLedger {...props} />);
  expect(clearedMarkup).toContain("Server income");
  expect(clearedMarkup).toContain("Default expense");
  cleanup?.();
});

it("maps ledger shortcuts only when transactions are selected", () => {
  expect(getLedgerShortcutAction("Delete", 1)).toBe("confirm-delete");
  expect(getLedgerShortcutAction("Backspace", 1)).toBe("confirm-delete");
  expect(getLedgerShortcutAction("Escape", 1)).toBe("clear-selection");
  expect(getLedgerShortcutAction("Delete", 0)).toBeNull();
});

it("keeps transaction selection, editing, and bulk deletion accessible", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      subcategories={[
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
          archivedAt: null,
          categoryArchivedAt: null,
        },
      ]}
      members={[{ id: "member-id", label: "You", color: "#dcece3" }]}
      transactions={[
        {
          id: "transaction-id",
          kind: "expense",
          amount: 3,
          occurredOn: "2026-07-15",
          subcategoryId: "groceries",
          note: "A long supermarket note that should not push the action column outside the card",
          createdAt: "2026-07-15T08:00:00Z",
          paidBy: "member-id",
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="Select all transactions"');
  expect(markup).toContain(
    'aria-label="Select A long supermarket note that should not push the action column outside the card transaction"',
  );
  expect(markup).toContain('aria-label="Edit A long supermarket note that should not push the action column outside the card transaction"');
  expect(markup).toContain('aria-label="Delete selected transactions"');
  expect(markup).toContain('aria-haspopup="dialog"');
  expect(markup).toContain('data-category-icon="utensils"');
  expect(markup).toContain(">Groceries</span>");
});

it("shows a subdued subcategory badge with its inherited icon", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      subcategories={[
        {
          id: "parking",
          name: "Parking",
          categoryId: "transportation",
          categoryName: "Transportation",
          kind: "expense",
          color: "#e49ae9",
          icon: "car",
          archivedAt: null,
          categoryArchivedAt: null,
        },
      ]}
      members={[]}
      transactions={[
        {
          id: "parking-transaction",
          kind: "expense",
          amount: 20,
          occurredOn: "2026-08-07",
          subcategoryId: "parking",
          note: "Parking",
          createdAt: "2026-08-07T08:00:00Z",
          paidBy: null,
        },
      ]}
    />,
  );

  expect(markup).toContain('data-category-icon="car"');
  expect(markup).toContain(">Parking</span>");
  expect(markup).not.toContain("Transportation → Parking");
  expect(markup).toContain("color-mix(in srgb, #e49ae9 55%, var(--card))");
  expect(markup).toContain("hover:bg-foreground/5");
  expect(markup).toContain("data-[state=selected]:bg-foreground/10");
});

it("renders imported merchant details with uncategorized and unassigned fallbacks", () => {
  const transaction: ImportedLedgerTransaction = {
    id: "imported-id",
    kind: "expense",
    amount: 50,
    occurredOn: "2026-07-15",
    subcategoryId: null,
    note: "Statement note",
    merchant: "Super Pharm",
    source: "statement_import",
    createdAt: "2026-07-15T08:00:00Z",
    paidBy: null,
  };
  const markup = renderToStaticMarkup(<TransactionLedger members={[]} transactions={[transaction]} />);

  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("Uncategorized");
  expect(markup).toContain("Unassigned");
  expect(markup).toContain('aria-label="Select Super Pharm transaction"');
});

it("sizes ledger columns from their contents", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      members={[]}
      transactions={[
        {
          id: "transaction-id",
          kind: "expense",
          amount: 50,
          occurredOn: "2026-07-15",
          subcategoryId: null,
          note: "Groceries",
          createdAt: "2026-07-15T08:00:00Z",
          paidBy: null,
        },
      ]}
    />,
  );

  expect(markup).not.toContain("table-fixed");
  expect(markup).not.toContain("<colgroup>");
});

it("limits rows to the selected custom date range", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      members={[]}
      dateRange={{ from: "2026-06-10", to: "2026-06-20" }}
      transactions={[
        {
          id: "outside",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-06-01",
          subcategoryId: null,
          note: "Outside range",
          createdAt: "2026-06-01T08:00:00Z",
          paidBy: null,
        },
        {
          id: "inside",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-06-15",
          subcategoryId: null,
          note: "Inside range",
          createdAt: "2026-06-15T08:00:00Z",
          paidBy: null,
        },
      ]}
    />,
  );

  expect(markup).toContain("Inside range");
  expect(markup).not.toContain("Outside range");
});

it("names an empty custom range accurately", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger members={[]} dateRange={{ from: "2026-06-10", to: "2026-06-20" }} transactions={[]} />,
  );

  expect(markup).toContain("No transactions for this date range.");
});

it("filters by selected categories and payers", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      members={[]}
      categoryIds={["food"]}
      paidByIds={["you"]}
      subcategories={[
        {
          id: "groceries",
          name: "Groceries",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
          archivedAt: null,
          categoryArchivedAt: null,
        },
        {
          id: "restaurants",
          name: "Restaurants",
          categoryId: "food",
          categoryName: "Food",
          kind: "expense",
          color: "#d9f0fa",
          icon: "utensils",
          archivedAt: null,
          categoryArchivedAt: null,
        },
        {
          id: "other",
          name: "Other",
          categoryId: "other",
          categoryName: "Other",
          kind: "expense",
          color: "#d9f0fa",
          icon: "tag",
          archivedAt: null,
          categoryArchivedAt: null,
        },
      ]}
      transactions={[
        {
          id: "match",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-06-15",
          subcategoryId: "groceries",
          note: "Matches filters",
          createdAt: "2026-06-15T08:00:00Z",
          paidBy: "you",
        },
        {
          id: "category",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-06-15",
          subcategoryId: "other",
          note: "Wrong category",
          createdAt: "2026-06-15T08:00:00Z",
          paidBy: "you",
        },
        {
          id: "payer",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-06-15",
          subcategoryId: "restaurants",
          note: "Wrong payer",
          createdAt: "2026-06-15T08:00:00Z",
          paidBy: "them",
        },
      ]}
    />,
  );

  expect(markup).toContain("Matches filters");
  expect(markup).not.toContain("Wrong category");
  expect(markup).not.toContain("Wrong payer");
});

it("filters, sorts, and exposes selection controls without making rows editable", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      members={[]}
      filterKind="income"
      sort="amount-desc"
      transactions={[
        {
          id: "small-income",
          kind: "income",
          amount: 20,
          occurredOn: "2026-07-15",
          subcategoryId: null,
          note: "Small income",
          createdAt: "2026-07-15T08:00:00Z",
          paidBy: null,
        },
        {
          id: "large-income",
          kind: "income",
          amount: 100,
          occurredOn: "2026-07-14",
          subcategoryId: null,
          note: "Large income",
          createdAt: "2026-07-14T08:00:00Z",
          paidBy: null,
        },
        {
          id: "expense",
          kind: "expense",
          amount: 50,
          occurredOn: "2026-07-16",
          subcategoryId: null,
          note: "Expense",
          createdAt: "2026-07-16T08:00:00Z",
          paidBy: null,
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="Select all transactions"');
  expect(markup).toContain('aria-label="Select Large income transaction"');
  expect(markup).not.toContain("Expense");
  expect(markup.indexOf("Large income")).toBeLessThan(markup.indexOf("Small income"));
  expect(markup).toContain('aria-label="Edit Large income transaction"');
});

it("applies URL filter changes without new server-provided filter props", () => {
  mocks.searchParams = new URLSearchParams("filter=expense&paidBy=them");
  const markup = renderToStaticMarkup(
    <TransactionLedger
      members={[]}
      transactions={[
        {
          id: "matching-expense",
          kind: "expense",
          amount: 20,
          occurredOn: "2026-07-15",
          subcategoryId: null,
          note: "Matching expense",
          createdAt: "2026-07-15T08:00:00Z",
          paidBy: "them",
        },
        {
          id: "other-expense",
          kind: "expense",
          amount: 30,
          occurredOn: "2026-07-14",
          subcategoryId: null,
          note: "Other expense",
          createdAt: "2026-07-14T08:00:00Z",
          paidBy: "you",
        },
      ]}
    />,
  );

  expect(markup).toContain("Matching expense");
  expect(markup).not.toContain("Other expense");
});
