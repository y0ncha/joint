import { expect, it } from "vitest";

import { canonicalBillsGroceriesParams } from "@/lib/bills-groceries-page";

it("canonicalizes Bills and Groceries selections without losing unrelated query parameters", () => {
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
    ).toString(),
  ).toBe("view=table&period=rolling&bills=electricity%2Cwater&bill=water&groceryMonth=2026-07");
});
