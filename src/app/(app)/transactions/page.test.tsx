import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLedgerData: vi.fn(),
  ledgerKeys: [] as string[],
  push: vi.fn(),
}));

vi.mock("@/lib/dashboard-read-model", () => ({ getLedgerData: mocks.getLedgerData }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => {
    mocks.ledgerKeys.push(String((children as { key?: unknown }).key ?? ""));
    return <div>{children}</div>;
  },
  CardHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

import TransactionsPage from "./page";

describe("Transactions page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ledgerKeys.length = 0;
    mocks.getLedgerData.mockResolvedValue({
      categories: [{ id: "food", name: "Food", kind: "expense", archivedAt: null }],
      categoryIds: ["food", "uncategorized"],
      directCategories: [],
      subcategories: [
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
      ],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      paidByIds: [],
      schedules: [],
      transactions: [
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
      ],
    });
  });

  it("defaults its monthly ledger to the previous month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));

    await TransactionsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getLedgerData).toHaveBeenCalledWith({
      categoryIds: [],
      filterKind: "all",
      month: "2026-07",
      paidByIds: [],
      range: undefined,
      sort: "date-desc",
    });
    vi.useRealTimers();
  });

  it("loads the selected ledger month and renders month and year selectors", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-06" }) }));

    expect(mocks.getLedgerData).toHaveBeenCalledWith(expect.objectContaining({ month: "2026-06" }));
    expect(markup).toContain('aria-label="Select ledger month"');
    expect(markup).toContain('aria-label="Select ledger year"');
    expect(markup).not.toContain(">Month<");
    expect(markup).not.toContain(">Year<");
    expect(markup).not.toContain(">Custom range<");
    expect(markup.match(/<button[^>]*aria-label="Select ledger month"[^>]*>/)?.[0]).toContain("min-h-11");
    expect(markup.match(/<button[^>]*aria-label="Select ledger year"[^>]*>/)?.[0]).toContain("min-h-11");
    expect(markup.match(/<button[^>]*aria-label="Choose custom date range"[^>]*>/)?.[0]).toContain("min-h-11");
  });

  it("opens the import sidebar without replacing the transactions page", async () => {
    const markup = renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ import: "1" }) }));

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Add transaction"');
  });

  it("uses all household transactions for a custom date range", async () => {
    const markup = renderToStaticMarkup(
      await TransactionsPage({ searchParams: Promise.resolve({ from: "2026-06-10", to: "2026-06-20" }) }),
    );

    expect(markup).toContain("Inside range");
    expect(markup).not.toContain("Outside range");
    expect(markup).toContain("Review your household ledger from 10/06/2026 – 20/06/2026.");
    expect(markup).toContain("Date range ledger");
    expect(mocks.getLedgerData).toHaveBeenCalledWith(expect.objectContaining({ range: { from: "2026-06-10", to: "2026-06-20" } }));
  });

  it("passes requested ledger filters and sort to the bounded read", async () => {
    await TransactionsPage({
      searchParams: Promise.resolve({
        categories: "food,unknown",
        filter: "expense",
        paidBy: "member-id,unknown",
        sort: "amount-desc",
      }),
    });

    expect(mocks.getLedgerData).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryIds: ["food", "unknown"],
        filterKind: "expense",
        paidByIds: ["member-id", "unknown"],
        sort: "amount-desc",
      }),
    );
  });

  it("ignores an impossible custom date range", async () => {
    const markup = renderToStaticMarkup(
      await TransactionsPage({ searchParams: Promise.resolve({ from: "2026-02-30", to: "2026-03-01" }) }),
    );

    expect(markup).toContain("Start date – End date");
    expect(markup).not.toContain("02 Mar 2026 – 01 Mar 2026");
  });

  it("resets the ledger instance when the visible scope or sort changes", async () => {
    renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-06" }) }));
    renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-06", filter: "expense" }) }));
    renderToStaticMarkup(await TransactionsPage({ searchParams: Promise.resolve({ month: "2026-06", sort: "amount-desc" }) }));

    expect(new Set(mocks.ledgerKeys).size).toBe(3);
  });
});
