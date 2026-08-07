import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentHouseholdContext: vi.fn() }));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));

const merchantAutomations = await import("./merchant-automations");

beforeEach(() => {
  vi.resetAllMocks();
});

it("normalizes and assigns from the first matching rule of each action", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
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
  const result = merchantAutomations.evaluateMerchantAutomations(
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

  expect(result.merchant).toBe("Aroma");
  expect(result.subcategoryId).toBe("chosen");
  expect(result.appliedRuleIds).toEqual(["normalize"]);
});

it("reports same-action matches while preserving first-rule priority", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
    { merchant: "Aroma Jaffa", kind: "expense", categoryId: null, subcategoryId: null },
    [
      { id: "first", action: "normalize_merchant", pattern: "Aroma", replacement: "Aroma", enabled: true, position: 0 },
      { id: "second", action: "normalize_merchant", pattern: "Jaffa", replacement: "Aroma Jaffa", enabled: true, position: 1 },
    ],
  );

  expect(result.merchant).toBe("Aroma");
  expect(result.conflicts).toEqual([{ action: "normalize_merchant", winnerId: "first", shadowedRuleIds: ["second"] }]);
});

it("rejects patterns that are not RE2-compatible", () => {
  expect(() => merchantAutomations.compileMerchantPattern("(")).toThrow();
});

it("orders matches by persisted position, created_at, and id", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
    { merchant: "Shop", kind: "expense", categoryId: null, subcategoryId: null },
    [
      {
        id: "z-id",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "Z",
        enabled: true,
        position: 0,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "a-id",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "A",
        enabled: true,
        position: 0,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "created-later",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "Later",
        enabled: true,
        position: 0,
        createdAt: "2026-08-02T00:00:00Z",
      },
    ],
  );

  expect(result.merchant).toBe("A");
  expect(result.conflicts[0]).toEqual({
    action: "normalize_merchant",
    winnerId: "a-id",
    shadowedRuleIds: ["z-id", "created-later"],
  });
});

it("skips disabled rules and treats normalization replacements as literals", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
    { merchant: "Shop 123", kind: "expense", categoryId: null, subcategoryId: null },
    [
      { id: "disabled", action: "normalize_merchant", pattern: "shop", replacement: "Disabled", enabled: false, position: 0 },
      { id: "literal", action: "normalize_merchant", pattern: "shop", replacement: "$&", enabled: true, position: 1 },
    ],
  );

  expect(result.merchant).toBe("$&");
  expect(result.appliedRuleIds).toEqual(["literal"]);
});

it("matches category rules against the original merchant before normalization", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
    { merchant: "Old Shop", kind: "expense", categoryId: null, subcategoryId: null },
    [
      { id: "normalize", action: "normalize_merchant", pattern: "old", replacement: "New Shop", enabled: true, position: 0 },
      {
        id: "category",
        action: "assign_category",
        pattern: "new",
        categoryId: "category-id",
        subcategoryId: null,
        destinationKind: "expense",
        enabled: true,
        position: 1,
      },
    ],
  );

  expect(result.merchant).toBe("New Shop");
  expect(result.categoryId).toBeNull();
  expect(result.appliedRuleIds).toEqual(["normalize"]);
});

it("reads an exact-count rules page in persisted order", async () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue({
    data: [
      {
        id: "rule-id",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "Shop",
        category_id: null,
        subcategory_id: null,
        enabled: true,
        position: 0,
        created_at: "2026-08-01T00:00:00Z",
      },
    ],
    count: 7,
    error: null,
  });
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    householdId: "household-id",
    userId: "member-id",
    role: "member",
    supabase: { from: vi.fn().mockReturnValue(query) },
  });

  await expect(merchantAutomations.getMerchantAutomationRulesPage({ from: 0, to: 99 })).resolves.toEqual({
    count: 7,
    rules: [
      {
        id: "rule-id",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "Shop",
        categoryId: null,
        subcategoryId: null,
        enabled: true,
        position: 0,
        createdAt: "2026-08-01T00:00:00Z",
      },
    ],
  });
  expect(query.select).toHaveBeenCalledWith(
    "id, action, pattern, replacement, category_id, subcategory_id, enabled, position, created_at",
    { count: "exact" },
  );
  expect(query.range).toHaveBeenCalledWith(0, 99);
});

it("fingerprints only the target transaction fields accepted by the apply RPC", () => {
  const fingerprint = merchantAutomations.fingerprintAutomationPreview([
    {
      id: "transaction-id",
      merchant: "Shop",
      category_id: "category-id",
      subcategory_id: null,
      expected_updated_at: "2026-08-07T10:00:00Z",
      expected_merchant: "Old Shop",
      expected_category_id: null,
      expected_subcategory_id: "old-subcategory-id",
    },
  ]);

  expect(fingerprint).toBe(
    '[{"id":"transaction-id","merchant":"Shop","category_id":"category-id","subcategory_id":null,"expected_updated_at":"2026-08-07T10:00:00Z","expected_merchant":"Old Shop","expected_category_id":null,"expected_subcategory_id":"old-subcategory-id"}]',
  );
});
