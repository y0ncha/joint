import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

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
  expect(markup).toContain("Food → Groceries");
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
