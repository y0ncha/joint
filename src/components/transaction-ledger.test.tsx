import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { TransactionLedger } from "./transaction-ledger";

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
});
