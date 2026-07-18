import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const transactionSheetModule = await import("./transaction-sheet").catch(() => null);

it("renders the simplified transaction composer without account or transfer choices", () => {
  const markup = transactionSheetModule ? renderToStaticMarkup(
    <transactionSheetModule.TransactionSheet
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
  ) : "";
  const source = readFileSync("src/components/transaction-sheet.tsx", "utf8");

  expect(markup).toContain("aria-label=\"Add transaction\"");
  expect(markup).toContain("lucide-plus");
  expect(markup).toContain("data-variant=\"ghost\"");
  expect(markup).toContain("size-9");
  expect(markup).not.toContain(">Add</span>");
  expect(source).toContain("Income");
  expect(source).toContain("Expense");
  expect(source).toContain("transition-[background-color,border-color,color,box-shadow]");
  expect(source).toContain("duration-300");
  expect(source).toContain("motion-reduce:transition-none");
  expect(source).toContain("data-[state=on]:bg-primary");
  expect(source).toContain("data-[state=on]:text-primary-foreground");
  expect(source).toContain("Paid by");
  expect(source).toContain("Choose date");
  expect(source).toContain("h-dvh w-full max-w-none");
  expect(source).toContain("md:w-3/4 md:max-w-lg");
  expect(source).not.toContain("sm:w-3/4 sm:max-w-lg");
  expect(source).not.toContain("Transfer");
  expect(source).not.toContain("Account</FieldLabel>");
  expect(source).not.toContain("credit card");
});

it("renders edit mode with saved transaction values and deletion inside the sheet", () => {
  const source = readFileSync("src/components/transaction-sheet.tsx", "utf8");

  expect(source).toContain("updateTransaction(transaction.id, formData)");
  expect(source).not.toContain("accountId");
  expect(source).not.toContain("destinationAccountId");
  expect(source).toContain("const shouldRenderDefaultTrigger = !isEditing && open === undefined && onOpenChange === undefined");
  expect(source).toContain("shouldRenderDefaultTrigger ?");
  expect(source).toContain("Edit transaction");
  expect(source).toContain("Update or remove this shared ledger entry.");
  expect(source).toContain("defaultValue={transaction?.amount ?? undefined}");
  expect(source).toContain("defaultValue={transaction?.note ?? undefined}");
  expect(source).toContain("Save changes");
  expect(source).toContain("Delete transaction");
});

it("preserves the local calendar day when serializing a selected date", () => {
  const source = readFileSync("src/components/transaction-sheet.tsx", "utf8");

  expect(source).toContain("function dateOnlyFromLocalDate(value: Date)");
  expect(source).toContain("value.getFullYear()");
  expect(source).toContain("value.getMonth() + 1");
  expect(source).toContain("value.getDate()");
  expect(source).not.toContain("toISOString()");
});
