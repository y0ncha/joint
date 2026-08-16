import { describe, expect, it } from "vitest";

import { analyticsNavigationKind, buildAnalyticsUrl, parseAnalyticsPresentationState } from "./analytics-navigation";

describe("Analytics navigation", () => {
  it.each([
    [{ period: "calendar" }, "data"],
    [{ groceryMonth: "2026-07" }, "data"],
    [{ bills: "rent,water" }, "presentation"],
    [{ yoy: "water", grocery: "top-ups" }, "presentation"],
    [{ bills: "rent", period: "rolling" }, "data"],
  ] as const)("classifies %o updates as %s navigation", (updates, expected) => {
    expect(analyticsNavigationKind(updates)).toBe(expected);
  });

  it("updates owned keys without losing unknown or repeated parameters", () => {
    const params = new URLSearchParams("source=household&source=partner&period=rolling&yoy=rent");

    expect(buildAnalyticsUrl("/analytics", params, { period: "calendar", grocery: "main-run" })).toBe(
      "/analytics?source=household&source=partner&period=calendar&yoy=rent&grocery=main-run",
    );
    expect(buildAnalyticsUrl("/analytics", params, { yoy: null })).toBe("/analytics?source=household&source=partner&period=rolling");
  });

  it("parses valid presentation selections and removes duplicate Bills", () => {
    expect(
      parseAnalyticsPresentationState(new URLSearchParams("bills=water,rent,water&yoy=water&grocery=top-ups"), {
        availableBillIds: ["rent", "water"],
        fallbackBillIds: ["rent"],
        fallbackYoy: "rent",
      }),
    ).toEqual({ billIds: ["water", "rent"], yoy: "water", grocery: "top-ups" });
  });

  it("falls back atomically for invalid or empty presentation selections", () => {
    expect(
      parseAnalyticsPresentationState(new URLSearchParams("bills=rent,deleted&yoy=deleted&grocery=unknown"), {
        availableBillIds: ["rent", "water"],
        fallbackBillIds: ["rent"],
        fallbackYoy: "water",
      }),
    ).toEqual({ billIds: ["rent"], yoy: "water", grocery: "all" });
    expect(
      parseAnalyticsPresentationState(new URLSearchParams("bills="), {
        availableBillIds: ["rent"],
        fallbackBillIds: ["rent"],
        fallbackYoy: "rent",
      }),
    ).toEqual({ billIds: ["rent"], yoy: "rent", grocery: "all" });
  });
});
