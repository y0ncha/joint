import { describe, expect, it } from "vitest";

import { billsGroceriesNavigationKind, buildBillsGroceriesUrl, parseBillsGroceriesPresentationState } from "./bills-groceries-navigation";

describe("Bills & Groceries navigation", () => {
  it.each([
    [{ period: "calendar" }, "data"],
    [{ groceryMonth: "2026-07" }, "data"],
    [{ bills: "rent,water" }, "presentation"],
    [{ bill: "water", grocery: "top-ups" }, "presentation"],
    [{ bills: "rent", period: "rolling" }, "data"],
  ] as const)("classifies %o updates as %s navigation", (updates, expected) => {
    expect(billsGroceriesNavigationKind(updates)).toBe(expected);
  });

  it("updates owned keys without losing unknown or repeated parameters", () => {
    const params = new URLSearchParams("source=household&source=partner&period=rolling&bill=rent");

    expect(buildBillsGroceriesUrl("/bills-groceries", params, { period: "calendar", grocery: "main-run" })).toBe(
      "/bills-groceries?source=household&source=partner&period=calendar&bill=rent&grocery=main-run",
    );
    expect(buildBillsGroceriesUrl("/bills-groceries", params, { bill: null })).toBe(
      "/bills-groceries?source=household&source=partner&period=rolling",
    );
  });

  it("parses valid presentation selections and removes duplicate Bills", () => {
    expect(
      parseBillsGroceriesPresentationState(new URLSearchParams("bills=water,rent,water&bill=water&grocery=top-ups"), {
        availableBillIds: ["rent", "water"],
        fallbackBillIds: ["rent"],
        fallbackBillId: "rent",
      }),
    ).toEqual({ billIds: ["water", "rent"], billId: "water", grocery: "top-ups" });
  });

  it("falls back atomically for invalid or empty presentation selections", () => {
    expect(
      parseBillsGroceriesPresentationState(new URLSearchParams("bills=rent,deleted&bill=deleted&grocery=unknown"), {
        availableBillIds: ["rent", "water"],
        fallbackBillIds: ["rent"],
        fallbackBillId: "water",
      }),
    ).toEqual({ billIds: ["rent"], billId: "water", grocery: "all" });
    expect(
      parseBillsGroceriesPresentationState(new URLSearchParams("bills="), {
        availableBillIds: ["rent"],
        fallbackBillIds: ["rent"],
        fallbackBillId: null,
      }),
    ).toEqual({ billIds: ["rent"], billId: "rent", grocery: "all" });
  });
});
