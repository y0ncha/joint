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

  expect(markup).toContain("min-w-[680px] table-fixed");
  expect(markup).toContain("w-[16%]");
  expect(markup).toContain("max-w-[14rem] truncate");
  expect(markup).toContain("text-right");
  expect(markup).toContain('aria-label="Select all transactions"');
  expect(markup).toContain('aria-label="Select A long supermarket note that should not push the action column outside the card transaction"');
  expect(markup).toContain('data-slot="checkbox"');
  expect(readFileSync("src/components/ui/checkbox.tsx", "utf8")).toContain("size-4");
  expect(readFileSync("src/components/ui/checkbox.tsx", "utf8")).toContain("data-checked:bg-primary");
  expect(markup).toContain("background-color:#dcece3;border-color:color-mix(in srgb, #dcece3, black 20%);color:color-mix(in srgb, #dcece3, black 60%)");
  expect(markup).toContain("aria-label=\"Edit A long supermarket note that should not push the action column outside the card transaction\"");
  expect(markup).not.toContain("aria-label=\"Add transaction\"");
  expect(markup).toContain("aria-label=\"Delete selected transactions\"");
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
  expect((markup.match(/border-muted-foreground\/20 bg-muted text-muted-foreground/g) ?? []).length).toBe(2);
  expect(markup).toContain("border-muted-foreground/20 bg-muted text-muted-foreground");
  expect(markup).not.toContain("(Imported)");
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
