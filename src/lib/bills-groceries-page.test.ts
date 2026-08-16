import { expect, it } from "vitest";

import { canonicalBillsGroceriesParams } from "@/lib/bills-groceries-page";

it("keeps only non-default Bills and Groceries selections without losing unrelated query parameters", () => {
  expect(
    canonicalBillsGroceriesParams(
      new URLSearchParams(
        "view=table&period=year&bills=deleted&bill=deleted&groceryMonth=2026-13&groceryFrom=2026-06-30&groceryTo=2026-07-01",
      ),
      {
        period: "rolling",
        billIds: ["electricity", "water"],
        billId: "water",
        groceryRange: { from: "2026-07-01", to: "2026-07-31" },
      },
      {
        period: "rolling",
        billIds: ["electricity", "water"],
        billId: "electricity",
        groceryRange: { from: "2026-06-01", to: "2026-06-30" },
      },
    ).toString(),
  ).toBe("view=table&bill=water&groceryMonth=2026-07");
});

it("keeps the default Bills and Groceries route bare", () => {
  const defaults = {
    period: "rolling" as const,
    billIds: ["electricity", "water"],
    billId: "electricity",
    groceryRange: { from: "2026-06-01", to: "2026-06-30" },
  };

  expect(canonicalBillsGroceriesParams(new URLSearchParams(), defaults, defaults).toString()).toBe("");
});
