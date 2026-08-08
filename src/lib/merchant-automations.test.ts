import { beforeEach, expect, it, vi } from "vitest";
import type { MerchantAutomationRule } from "./merchant-automations";

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

it("evaluates note and amount conditions with AND/OR semantics before selecting an action", () => {
  const result = merchantAutomations.evaluateMerchantAutomations(
    { merchant: "Fresh Market", note: "Weekly groceries", amount: 125, kind: "expense", categoryId: null, subcategoryId: null },
    [
      {
        id: "condition-rule",
        action: "assign_category",
        pattern: "__conditions__",
        conditions: {
          logic: "and",
          conditions: [
            { field: "note", operator: "contains", value: "weekly" },
            { field: "amount", operator: "less_than_or_equal", value: 125 },
          ],
        },
        categoryId: null,
        subcategoryId: "groceries-id",
        destinationKind: "expense",
        enabled: true,
        position: 0,
      },
    ],
  );

  expect(result.subcategoryId).toBe("groceries-id");
  expect(result.appliedRuleIds).toEqual(["condition-rule"]);
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

it("reads the authenticated rules workspace with eligible destinations and a complete preview", async () => {
  const rulesQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  rulesQuery.select.mockReturnValue(rulesQuery);
  rulesQuery.eq.mockReturnValue(rulesQuery);
  rulesQuery.order.mockReturnValue(rulesQuery);
  rulesQuery.range.mockResolvedValue({
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
    count: 1,
    error: null,
  });
  const categoryNameOrder = vi.fn().mockResolvedValue({
    data: [
      { id: "food-id", name: "Food", kind: "expense", color: "#111111", icon: "utensils", archived_at: null, system_key: null },
      { id: "bills-id", name: "Bills", kind: "expense", color: "#222222", icon: "receipt", archived_at: null, system_key: "bills" },
      {
        id: "other-id",
        name: "Renamed Other",
        kind: "expense",
        color: "#333333",
        icon: "tag",
        archived_at: null,
        system_key: "other_expense",
      },
      {
        id: "other-income-id",
        name: "Other",
        kind: "income",
        color: "#666666",
        icon: "tag",
        archived_at: null,
        system_key: "other_income",
      },
    ],
    error: null,
  });
  const categoryKindOrder = vi.fn().mockReturnValue({ order: categoryNameOrder });
  const categoryIs = vi.fn().mockReturnValue({ order: categoryKindOrder });
  const categoryEq = vi.fn().mockReturnValue({ is: categoryIs });
  const subcategoryOrder = vi.fn().mockResolvedValue({
    data: [
      {
        id: "cafe-id",
        category_id: "food-id",
        name: "Cafe",
        color: "#444444",
        icon: "coffee",
        archived_at: null,
      },
      {
        id: "electricity-id",
        category_id: "bills-id",
        name: "Electricity",
        color: "#555555",
        icon: "zap",
        archived_at: null,
      },
    ],
    error: null,
  });
  const subcategoryIs = vi.fn().mockReturnValue({ order: subcategoryOrder });
  const subcategoryEq = vi.fn().mockReturnValue({ is: subcategoryIs });
  const transactionsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  transactionsQuery.select.mockReturnValue(transactionsQuery);
  transactionsQuery.eq.mockReturnValue(transactionsQuery);
  transactionsQuery.order.mockReturnValue(transactionsQuery);
  transactionsQuery.range.mockResolvedValue({
    data: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        merchant: "shop",
        kind: "expense",
        category_id: null,
        subcategory_id: null,
        updated_at: "2026-08-07T10:00:00Z",
      },
    ],
    count: 1,
    error: null,
  });
  const from = vi.fn((table: string) => {
    if (table === "automation_rules") return rulesQuery;
    if (table === "categories") return { select: vi.fn().mockReturnValue({ eq: categoryEq }) };
    if (table === "subcategories") return { select: vi.fn().mockReturnValue({ eq: subcategoryEq }) };
    if (table === "transactions") return transactionsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    householdId: "household-id",
    userId: "member-id",
    role: "member",
    supabase: { from },
  });

  await expect(merchantAutomations.getMerchantAutomationRulesPage({ from: 0, to: 99 })).resolves.toEqual({
    count: 1,
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
    destinations: [
      {
        categoryId: null,
        subcategoryId: "cafe-id",
        label: "Expense → Food → Cafe",
        kind: "expense",
        color: "#444444",
        icon: "coffee",
      },
      {
        categoryId: "other-id",
        subcategoryId: null,
        label: "Expense → Other",
        kind: "expense",
        color: "#333333",
        icon: "tag",
      },
      {
        categoryId: "other-income-id",
        subcategoryId: null,
        label: "Income → Other",
        kind: "income",
        color: "#666666",
        icon: "tag",
      },
    ],
    preview: {
      changes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          merchant: "Shop",
          category_id: null,
          subcategory_id: null,
          expected_updated_at: "2026-08-07T10:00:00Z",
          expected_merchant: "shop",
          expected_category_id: null,
          expected_subcategory_id: null,
        },
      ],
      conflicts: [],
      ruleSet: [
        {
          id: "rule-id",
          action: "normalize_merchant",
          pattern: "shop",
          conditions: null,
          replacement: "Shop",
          category_id: null,
          subcategory_id: null,
          enabled: true,
          position: 0,
        },
      ],
      fingerprint:
        '{"changes":[{"id":"11111111-1111-4111-8111-111111111111","merchant":"Shop","category_id":null,"subcategory_id":null,"expected_updated_at":"2026-08-07T10:00:00Z","expected_merchant":"shop","expected_category_id":null,"expected_subcategory_id":null}],"ruleSet":[{"id":"rule-id","action":"normalize_merchant","pattern":"shop","conditions":null,"replacement":"Shop","category_id":null,"subcategory_id":null,"enabled":true,"position":0}]}',
    },
  });
  expect(rulesQuery.select).toHaveBeenCalledWith(
    "id, action, pattern, conditions, replacement, category_id, subcategory_id, enabled, position, created_at",
    { count: "exact" },
  );
  expect(rulesQuery.range).toHaveBeenCalledWith(0, 99);
  expect(transactionsQuery.select).toHaveBeenCalledWith("id, merchant, kind, amount, note, category_id, subcategory_id, updated_at", {
    count: "exact",
  });
  expect(transactionsQuery.range).toHaveBeenCalledWith(0, 999);
});

it("loads destination kinds once for transaction intake", async () => {
  const finalRuleOrder = vi.fn().mockResolvedValue({
    data: [
      {
        id: "subcategory-rule",
        action: "assign_category",
        pattern: "shop",
        replacement: null,
        category_id: null,
        subcategory_id: "subcategory-id",
        enabled: true,
        position: 0,
        created_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "category-rule",
        action: "assign_category",
        pattern: "refund",
        replacement: null,
        category_id: "income-other",
        subcategory_id: null,
        enabled: true,
        position: 1,
        created_at: "2026-08-01T00:00:00Z",
      },
    ],
    error: null,
  });
  const ruleOrder = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ order: finalRuleOrder }) });
  const ruleEq = vi.fn().mockReturnValue({ order: ruleOrder });
  const subcategoryIn = vi.fn().mockResolvedValue({ data: [{ id: "subcategory-id", category_id: "expense-category" }], error: null });
  const subcategoryEq = vi.fn().mockReturnValue({ in: subcategoryIn });
  const categoryIn = vi.fn().mockResolvedValue({
    data: [
      { id: "expense-category", kind: "expense" },
      { id: "income-other", kind: "income" },
    ],
    error: null,
  });
  const categoryEq = vi.fn().mockReturnValue({ in: categoryIn });
  const from = vi.fn((table: string) => {
    if (table === "automation_rules") return { select: vi.fn().mockReturnValue({ eq: ruleEq }) };
    if (table === "subcategories") return { select: vi.fn().mockReturnValue({ eq: subcategoryEq }) };
    if (table === "categories") return { select: vi.fn().mockReturnValue({ eq: categoryEq }) };
    throw new Error(`Unexpected table: ${table}`);
  });

  await expect(merchantAutomations.getMerchantAutomationRules({ from } as never, "household-id")).resolves.toEqual([
    expect.objectContaining({ id: "subcategory-rule", destinationKind: "expense" }),
    expect.objectContaining({ id: "category-rule", destinationKind: "income" }),
  ]);
  expect(subcategoryIn).toHaveBeenCalledWith("id", ["subcategory-id"]);
  expect(categoryIn).toHaveBeenCalledWith("id", ["income-other", "expense-category"]);
});

it("fingerprints the target transaction fields and deterministic rule-set snapshot", () => {
  const fingerprint = merchantAutomations.fingerprintAutomationPreview(
    [
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
    ],
    [
      {
        id: "rule-id",
        action: "normalize_merchant",
        pattern: "shop",
        replacement: "Shop",
        category_id: null,
        subcategory_id: null,
        enabled: true,
        position: 0,
      },
    ],
  );

  expect(fingerprint).toBe(
    '{"changes":[{"id":"transaction-id","merchant":"Shop","category_id":"category-id","subcategory_id":null,"expected_updated_at":"2026-08-07T10:00:00Z","expected_merchant":"Old Shop","expected_category_id":null,"expected_subcategory_id":"old-subcategory-id"}],"ruleSet":[{"id":"rule-id","action":"normalize_merchant","pattern":"shop","replacement":"Shop","category_id":null,"subcategory_id":null,"enabled":true,"position":0}]}',
  );
});

it("previews only changed transactions and groups same-action conflicts", () => {
  const rules: MerchantAutomationRule[] = [
    {
      id: "normalize-first",
      action: "normalize_merchant",
      pattern: "shop",
      conditions: null,
      replacement: "Shop",
      enabled: true,
      position: 0,
    },
    {
      id: "normalize-shadowed",
      action: "normalize_merchant",
      pattern: "market",
      conditions: null,
      replacement: "Market",
      enabled: true,
      position: 1,
    },
    {
      id: "category",
      action: "assign_category",
      pattern: "shop",
      conditions: null,
      categoryId: null,
      subcategoryId: "groceries-id",
      destinationKind: "expense",
      enabled: true,
      position: 2,
    },
  ];

  const preview = merchantAutomations.previewMerchantAutomations(
    [
      {
        id: "11111111-1111-4111-8111-111111111111",
        merchant: "shop market",
        kind: "expense",
        categoryId: null,
        subcategoryId: null,
        updatedAt: "2026-08-07T10:00:00Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        merchant: "unmatched",
        kind: "expense",
        categoryId: null,
        subcategoryId: null,
        updatedAt: "2026-08-07T11:00:00Z",
      },
    ],
    rules,
  );

  expect(preview.changes).toEqual([
    {
      id: "11111111-1111-4111-8111-111111111111",
      merchant: "Shop",
      category_id: null,
      subcategory_id: "groceries-id",
      expected_updated_at: "2026-08-07T10:00:00Z",
      expected_merchant: "shop market",
      expected_category_id: null,
      expected_subcategory_id: null,
    },
  ]);
  expect(preview.conflicts).toEqual([
    {
      action: "normalize_merchant",
      winnerId: "normalize-first",
      shadowedRuleIds: ["normalize-shadowed"],
      transactionCount: 1,
    },
  ]);
  expect(preview.ruleSet).toEqual([
    {
      id: "normalize-first",
      action: "normalize_merchant",
      pattern: "shop",
      conditions: null,
      replacement: "Shop",
      category_id: null,
      subcategory_id: null,
      enabled: true,
      position: 0,
    },
    {
      id: "normalize-shadowed",
      action: "normalize_merchant",
      pattern: "market",
      conditions: null,
      replacement: "Market",
      category_id: null,
      subcategory_id: null,
      enabled: true,
      position: 1,
    },
    {
      id: "category",
      action: "assign_category",
      pattern: "shop",
      conditions: null,
      replacement: null,
      category_id: null,
      subcategory_id: "groceries-id",
      enabled: true,
      position: 2,
    },
  ]);
  expect(preview.fingerprint).toBe(merchantAutomations.fingerprintAutomationPreview(preview.changes, preview.ruleSet));
});
