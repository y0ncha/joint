import { expect, it } from "vitest";

const merchantAutomations = await import("./merchant-automations").catch(() => null);

it("normalizes and assigns from the first matching rule of each action", () => {
  const result = merchantAutomations?.evaluateMerchantAutomations(
    { merchant: "ארומה סניף יפו", kind: "expense", categoryId: null, subcategoryId: null },
    [
      { id: "normalize", action: "normalize_merchant", pattern: "ארומה", replacement: "Aroma", enabled: true, position: 0 },
      {
        id: "cafe",
        action: "assign_category",
        pattern: "ארומה",
        categoryId: null,
        subcategoryId: "cafe-id",
        destinationKind: "expense",
        enabled: true,
        position: 1,
      },
    ],
  );

  expect(result).toEqual({
    merchant: "Aroma",
    categoryId: null,
    subcategoryId: "cafe-id",
    appliedRuleIds: ["normalize", "cafe"],
    conflicts: [],
  });
});

it("keeps an explicit assignment while still normalizing the merchant", () => {
  const result = merchantAutomations?.evaluateMerchantAutomations(
    { merchant: "AROMA", kind: "expense", categoryId: null, subcategoryId: "chosen" },
    [
      { id: "normalize", action: "normalize_merchant", pattern: "aroma", replacement: "Aroma", enabled: true, position: 0 },
      {
        id: "cafe",
        action: "assign_category",
        pattern: "aroma",
        categoryId: null,
        subcategoryId: "cafe-id",
        destinationKind: "expense",
        enabled: true,
        position: 1,
      },
    ],
  );

  expect(result?.merchant).toBe("Aroma");
  expect(result?.subcategoryId).toBe("chosen");
  expect(result?.appliedRuleIds).toEqual(["normalize"]);
});

it("reports same-action matches while preserving first-rule priority", () => {
  const result = merchantAutomations?.evaluateMerchantAutomations(
    { merchant: "Aroma Jaffa", kind: "expense", categoryId: null, subcategoryId: null },
    [
      { id: "first", action: "normalize_merchant", pattern: "Aroma", replacement: "Aroma", enabled: true, position: 0 },
      { id: "second", action: "normalize_merchant", pattern: "Jaffa", replacement: "Aroma Jaffa", enabled: true, position: 1 },
    ],
  );

  expect(result?.merchant).toBe("Aroma");
  expect(result?.conflicts).toEqual([{ action: "normalize_merchant", winnerId: "first", shadowedRuleIds: ["second"] }]);
});
