import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
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

it("keeps transaction details aligned inside a constrained ledger table", () => {
  const markup = renderToStaticMarkup(
    <TransactionLedger
      categories={[{ id: "food", name: "Food", kind: "expense", archivedAt: null }]}
      members={[{ id: "member-id", label: "You" }]}
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

  expect(markup).toContain("min-w-[680px] table-fixed");
  expect(markup).toContain("w-[16%]");
  expect(markup).toContain("max-w-[14rem] truncate");
  expect(markup).toContain("text-right");
  expect(markup).toContain("role=\"button\"");
  expect(markup).toContain("aria-label=\"Edit A long supermarket note that should not push the action column outside the card transaction\"");
  expect(markup).not.toContain("aria-label=\"Add transaction\"");
  expect(markup).not.toContain("aria-label=\"Delete");
  expect(markup).not.toContain(">Delete</button>");
  expect(readFileSync("src/components/transaction-ledger.tsx", "utf8")).not.toMatch(/transaction\.categoryId \?[^?]/);
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
  expect(markup).toContain("Imported");
  expect(markup).toContain('aria-label="Edit Super Pharm transaction"');
});
