import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => children,
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectGroup: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children }: { children: ReactNode }) => children,
  SelectTrigger: ({ children }: { children: ReactNode }) => children,
  SelectValue: ({ placeholder }: { placeholder?: string }) => placeholder,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ children }: { children: ReactNode }) => children,
  SheetDescription: ({ children }: { children: ReactNode }) => children,
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
  SheetTrigger: ({ children }: { children: ReactNode }) => children,
}));

import { TransactionSheet } from "./transaction-sheet";

type ImportedTransaction = {
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

it("renders the simplified transaction composer without account or transfer choices", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[
        { id: "salary", name: "Salary", kind: "income" },
        { id: "food", name: "Food", kind: "expense" },
      ]}
      currentUserId="member-id"
      members={[
        { id: "member-id", label: "You" },
        { id: "partner-id", label: "Partner" },
      ]}
    />,
  );
  expect(markup).toContain("aria-label=\"Add transaction\"");
  expect(markup).toContain("lucide-plus");
  expect(markup).toContain("data-variant=\"ghost\"");
  expect(markup).toContain("size-9");
  expect(markup).not.toContain(">Add</span>");
  expect(markup).toContain("Income");
  expect(markup).toContain("Expense");
  expect(markup).toContain("Paid by");
  expect(markup).toContain("Choose date");
  expect(markup).not.toContain("Transfer");
  expect(markup).not.toContain("Account");
  expect(markup).not.toContain("credit card");
});

it("renders edit mode with saved transaction values and deletion inside the sheet", () => {
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[{ id: "food", name: "Food", kind: "expense" }]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={{ id: "transaction-id", kind: "expense", amount: 50, occurredOn: "2026-07-14", categoryId: "food", note: "Saved note", merchant: "Saved merchant", source: "statement_import", createdAt: "2026-07-14T08:00:00Z", paidBy: "member-id" }}
    />,
  );

  expect(markup).toContain("Edit transaction");
  expect(markup).toContain("Update or remove this shared ledger entry.");
  expect(markup).toContain('name="amount" value="50"');
  expect(markup).toContain('name="note" value="Saved note"');
  expect(markup).toContain("Save changes");
  expect(markup).toContain("Delete transaction");
});

it("keeps an imported transaction unassigned while allowing its category to be edited", () => {
  const transaction: ImportedTransaction = {
    id: "imported-id",
    kind: "expense",
    amount: 50,
    occurredOn: "2026-07-14",
    categoryId: null,
    note: "Statement note",
    merchant: "Super Pharm",
    source: "statement_import",
    createdAt: "2026-07-14T08:00:00Z",
    paidBy: null,
  };
  const markup = renderToStaticMarkup(
    <TransactionSheet
      categories={[{ id: "food", name: "Food", kind: "expense" }]}
      members={[{ id: "member-id", label: "You" }]}
      transaction={transaction}
    />,
  );

  expect(markup).toContain("Merchant");
  expect(markup).toContain("Super Pharm");
  expect(markup).toContain("Unassigned");
  expect(markup).toContain('type="hidden" name="categoryId" value=""');
  expect(markup).toContain('type="hidden" name="paidBy" value=""');
});
