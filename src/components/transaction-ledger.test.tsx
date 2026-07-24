import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { TransactionLedger } from "./transaction-ledger";

type ImportedLedgerTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  categoryId: null;
  note: string;
  merchant: string;
  source: "statement_import";
  createdAt: string;
  paidBy: null;
};

it("keeps transaction selection, editing, and bulk deletion accessible", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      categories={[{ id: "food", name: "Food", kind: "expense", archivedAt: null }]}
      members={[{ id: "member-id", label: "You", color: "#dcece3" }]}
      transactions={[
        {
          id: "transaction-id",
          kind: "expense",
          amount: 3,
          occurredOn: "2026-07-15",
          categoryId: "food",
          note: "A long supermarket note that should not push the action column outside the card",
          createdAt: "2026-07-15T08:00:00Z",
          paidBy: "member-id",
        },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="Select all transactions"');
  expect(markup).toContain('aria-label="Select A long supermarket note that should not push the action column outside the card transaction"');
  expect(markup).toContain("aria-label=\"Edit A long supermarket note that should not push the action column outside the card transaction\"");
  expect(markup).toContain("aria-label=\"Delete selected transactions\"");
  expect(markup).toContain('aria-haspopup="dialog"');
});

it("renders imported merchant details with uncategorized and unassigned fallbacks", () => {
  const transaction: ImportedLedgerTransaction = {
    id: "imported-id",
    kind: "expense",
    amount: 50,
    occurredOn: "2026-07-15",
    categoryId: null,
    note: "Statement note",
    merchant: "Super Pharm",
    source: "statement_import",
    createdAt: "2026-07-15T08:00:00Z",
    paidBy: null,
  };
  const markup = renderToStaticMarkup(
    <TransactionLedger
      categories={[]}
      members={[]}
      transactions={[transaction]}
    />,
  );

  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("Uncategorized");
  expect(markup).toContain("Unassigned");
  expect(markup).toContain('aria-label="Select Super Pharm transaction"');
});

it("filters, sorts, and exposes selection controls without making rows editable", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      categories={[]}
      members={[]}
      filterKind="income"
      sort="amount-desc"
      transactions={[
        { id: "small-income", kind: "income", amount: 20, occurredOn: "2026-07-15", categoryId: null, note: "Small income", createdAt: "2026-07-15T08:00:00Z", paidBy: null },
        { id: "large-income", kind: "income", amount: 100, occurredOn: "2026-07-14", categoryId: null, note: "Large income", createdAt: "2026-07-14T08:00:00Z", paidBy: null },
        { id: "expense", kind: "expense", amount: 50, occurredOn: "2026-07-16", categoryId: null, note: "Expense", createdAt: "2026-07-16T08:00:00Z", paidBy: null },
      ]}
    />,
  );

  expect(markup).toContain('aria-label="Select all transactions"');
  expect(markup).toContain('aria-label="Select Large income transaction"');
  expect(markup).not.toContain("Expense");
  expect(markup.indexOf("Large income")).toBeLessThan(markup.indexOf("Small income"));
  expect(markup).toContain('aria-label="Edit Large income transaction"');
});
