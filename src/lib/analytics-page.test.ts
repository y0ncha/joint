import { expect, it } from "vitest";

import { canonicalAnalyticsParams } from "@/lib/analytics-page";

it("keeps only non-default Analytics selections without losing unrelated query parameters", () => {
  expect(
    canonicalAnalyticsParams(
      new URLSearchParams(
        "view=table&period=year&bills=deleted&yoy=deleted&groceryMonth=2026-13&groceryFrom=2026-06-30&groceryTo=2026-07-01",
      ),
      {
        period: "rolling",
        billIds: ["electricity", "water"],
        yoy: "water",
        groceryRange: { from: "2026-07-01", to: "2026-07-31" },
      },
      {
        period: "rolling",
        billIds: ["electricity", "water"],
        yoy: "electricity",
        groceryRange: { from: "2026-06-01", to: "2026-06-30" },
      },
    ).toString(),
  ).toBe("view=table&yoy=water&groceryMonth=2026-07");
});

it("keeps the default Analytics route bare", () => {
  const defaults = {
    period: "rolling" as const,
    billIds: ["electricity", "water"],
    yoy: "electricity",
    groceryRange: { from: "2026-06-01", to: "2026-06-30" },
  };

  expect(canonicalAnalyticsParams(new URLSearchParams(), defaults, defaults).toString()).toBe("");
});
