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

  expect(markup).toContain("Add transaction");
  expect(source).toContain("Income");
  expect(source).toContain("Expense");
  expect(source).toContain("transition-[background-color,border-color,color,box-shadow]");
  expect(source).toContain("duration-300");
  expect(source).toContain("motion-reduce:transition-none");
  expect(source).toContain("data-[state=on]:bg-primary");
  expect(source).toContain("data-[state=on]:text-primary-foreground");
  expect(source).toContain("Paid by");
  expect(source).toContain("Choose date");
  expect(source).not.toContain("Transfer");
  expect(source).not.toContain("Account</FieldLabel>");
  expect(source).not.toContain("credit card");
});
