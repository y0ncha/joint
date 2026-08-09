import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  getMerchantAutomationRulesPage: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  selectLastRule: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateEqId: vi.fn(),
  deleteEqId: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/merchant-automations", async () => ({
  ...(await vi.importActual<typeof import("@/lib/merchant-automations")>("@/lib/merchant-automations")),
  getMerchantAutomationRulesPage: mocks.getMerchantAutomationRulesPage,
}));

const actions = await import("./merchant-automations");
const ruleSet = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    action: "normalize_merchant" as const,
    pattern: "shop",
    replacement: "Shop",
    category_id: null,
    subcategory_id: null,
    enabled: true,
    position: 0,
  },
];
const previewChanges = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    merchant: "Shop",
    category_id: null,
    subcategory_id: "33333333-3333-4333-8333-333333333333",
    expected_updated_at: "2026-08-07T10:00:00Z",
    expected_merchant: "Old Shop",
    expected_category_id: null,
    expected_subcategory_id: null,
  },
];
const secondPreviewChange = {
  id: "44444444-4444-4444-8444-444444444444",
  merchant: "Other Shop",
  category_id: null,
  subcategory_id: null,
  expected_updated_at: "2026-08-07T11:00:00Z",
  expected_merchant: "Other old shop",
  expected_category_id: null,
  expected_subcategory_id: null,
  delete_transaction: true as const,
};
const automationPreview = { changes: previewChanges, conflicts: [], fingerprint: "current-fingerprint", ruleSet };

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

function normalizeRuleForm(overrides: Record<string, string> = {}) {
  return formData({
    action: "normalize_merchant",
    matchMode: "contains",
    matchValue: "shop",
    pattern: "shop",
    replacement: "Shop",
    enabled: "true",
    ...overrides,
  });
}

function deleteRuleForm(overrides: Record<string, string> = {}) {
  return formData({
    action: "delete_transaction",
    matchMode: "contains",
    matchValue: "duplicate",
    pattern: "duplicate",
    replacement: "",
    categoryId: "",
    subcategoryId: "",
    enabled: "true",
    ...overrides,
  });
}

function configureActionClient({ lastPosition = 2, error = null }: { lastPosition?: number | null; error?: unknown } = {}) {
  const lastRuleQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: mocks.selectLastRule.mockResolvedValue({ data: lastPosition === null ? null : { position: lastPosition }, error: null }),
  };
  lastRuleQuery.select.mockReturnValue(lastRuleQuery);
  lastRuleQuery.eq.mockReturnValue(lastRuleQuery);
  lastRuleQuery.order.mockReturnValue(lastRuleQuery);
  lastRuleQuery.limit.mockReturnValue(lastRuleQuery);
  mocks.insert.mockResolvedValue({ error });
  mocks.updateEqId.mockReturnValue({ eq: mocks.eq });
  mocks.deleteEqId.mockReturnValue({ eq: mocks.eq });
  mocks.update.mockReturnValue({ eq: mocks.updateEqId });
  mocks.delete.mockReturnValue({ eq: mocks.deleteEqId });
  mocks.eq.mockResolvedValue({ error });
  mocks.from.mockImplementation((table: string) => {
    if (table !== "automation_rules") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn().mockReturnValue(lastRuleQuery),
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.delete,
    };
  });
  mocks.rpc.mockResolvedValue({ data: 1, error });
}

describe("merchant automation actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({
      status: "member",
      householdId: "household-id",
      userId: "member-id",
      role: "member",
      supabase: { from: mocks.from, rpc: mocks.rpc },
    });
    mocks.getMerchantAutomationRulesPage.mockResolvedValue({ count: 1, rules: [], destinations: [], preview: automationPreview });
  });

  it.each([
    { matchMode: "contains", expectedPattern: "Aroma" },
    { matchMode: "equals", expectedPattern: "^Aroma$" },
    { matchMode: "starts_with", expectedPattern: "^Aroma" },
    { matchMode: "ends_with", expectedPattern: "Aroma$" },
  ])("persists a server-built $matchMode pattern instead of the submitted raw pattern", async ({ matchMode, expectedPattern }) => {
    configureActionClient();

    await expect(
      actions.createAutomationRule(
        normalizeRuleForm({
          matchMode,
          matchValue: "  Aroma  ",
          pattern: "(raw-pattern-injection",
        }),
      ),
    ).resolves.toEqual({ status: "success" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pattern: expectedPattern,
      }),
    );
  });

  it("rejects an unsupported merchant match mode before inserting a rule", async () => {
    configureActionClient();

    await expect(actions.createAutomationRule(normalizeRuleForm({ matchMode: "regex" }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { matchMode: "Choose a valid merchant match mode." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a delete rule without a replacement or destination", async () => {
    configureActionClient();

    await expect(actions.createAutomationRule(deleteRuleForm())).resolves.toEqual({ status: "success" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete_transaction",
        replacement: null,
        category_id: null,
        subcategory_id: null,
      }),
    );
  });

  it("rejects a server-built pattern longer than the database limit without truncating it", async () => {
    configureActionClient();

    await expect(
      actions.createAutomationRule(normalizeRuleForm({ matchMode: "contains", matchValue: ".".repeat(101) })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { pattern: "Use 200 characters or fewer." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("preserves a trimmed legacy advanced pattern when updating a rule", async () => {
    configureActionClient();

    await expect(
      actions.updateAutomationRule(
        "rule-id",
        normalizeRuleForm({
          matchMode: "advanced",
          matchValue: "  (Aroma|Cafe)  ",
          pattern: "raw-pattern-injection",
          replacement: "Updated",
        }),
      ),
    ).resolves.toEqual({ status: "success" });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pattern: "(Aroma|Cafe)",
      }),
    );
  });

  it("rejects an invalid advanced RE2 pattern before inserting a rule", async () => {
    configureActionClient();

    await expect(
      actions.createAutomationRule(normalizeRuleForm({ matchMode: "advanced", matchValue: "(", pattern: "valid-injection" })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { pattern: "Enter a valid RE2 pattern." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a rule at the next persisted position from verified household state", async () => {
    configureActionClient({ lastPosition: 4 });

    await expect(
      actions.createAutomationRule(
        formData({
          action: "assign_category",
          matchMode: "contains",
          matchValue: "shop",
          pattern: "shop",
          categoryId: "11111111-1111-4111-8111-111111111111",
          subcategoryId: "",
          enabled: "false",
          householdId: "other-household",
        }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith({
      household_id: "household-id",
      action: "assign_category",
      pattern: "shop",
      replacement: null,
      category_id: "11111111-1111-4111-8111-111111111111",
      subcategory_id: null,
      enabled: false,
      position: 5,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("persists an AND/OR condition group from trusted server-side parsing", async () => {
    configureActionClient({ lastPosition: null });
    const conditions = JSON.stringify({
      logic: "or",
      conditions: [
        { field: "note", operator: "contains", value: "weekly" },
        { field: "amount", operator: "greater_than_or_equal", value: 250 },
      ],
    });

    await expect(
      actions.createAutomationRule(
        formData({
          action: "assign_category",
          conditions,
          matchMode: "contains",
          matchValue: "ignored",
          pattern: "ignored",
          categoryId: "11111111-1111-4111-8111-111111111111",
          subcategoryId: "",
          enabled: "true",
        }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pattern: "__conditions__",
        conditions: {
          logic: "or",
          conditions: [
            { field: "note", operator: "contains", value: "weekly" },
            { field: "amount", operator: "greater_than_or_equal", value: 250 },
          ],
        },
      }),
    );
  });

  it("persists independent connectors from trusted server-side parsing", async () => {
    configureActionClient({ lastPosition: null });
    const conditions = JSON.stringify({
      conditions: [
        { field: "merchant", operator: "contains", value: "Cafe" },
        { connector: "or", field: "amount", operator: "greater_than", value: 100 },
      ],
    });

    await expect(
      actions.createAutomationRule(
        formData({
          action: "assign_category",
          conditions,
          matchMode: "contains",
          matchValue: "ignored",
          pattern: "ignored",
          categoryId: "11111111-1111-4111-8111-111111111111",
          subcategoryId: "",
          enabled: "true",
        }),
      ),
    ).resolves.toEqual({ status: "success" });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pattern: "__conditions__",
        conditions: {
          conditions: [
            { field: "merchant", operator: "contains", value: "Cafe" },
            { connector: "or", field: "amount", operator: "greater_than", value: 100 },
          ],
        },
      }),
    );
  });

  it("persists a Note regex condition after server-side RE2 validation", async () => {
    configureActionClient();
    const conditions = JSON.stringify({
      logic: "and",
      conditions: [{ field: "note", operator: "advanced", value: "(weekly|monthly)" }],
    });

    await expect(actions.createAutomationRule(normalizeRuleForm({ conditions }))).resolves.toEqual({ status: "success" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: {
          logic: "and",
          conditions: [{ field: "note", operator: "advanced", value: "(weekly|monthly)" }],
        },
      }),
    );
  });

  it("rejects an invalid Note regex before inserting a rule", async () => {
    configureActionClient();
    const conditions = JSON.stringify({
      logic: "and",
      conditions: [{ field: "note", operator: "advanced", value: "(" }],
    });

    await expect(actions.createAutomationRule(normalizeRuleForm({ conditions }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { pattern: "Enter a valid RE2 pattern." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("updates only the requested rule in the verified household", async () => {
    configureActionClient();

    await expect(actions.updateAutomationRule("rule-id", normalizeRuleForm({ replacement: "Updated" }))).resolves.toEqual({
      status: "success",
    });
    expect(mocks.update).toHaveBeenCalledWith({
      action: "normalize_merchant",
      pattern: "shop",
      replacement: "Updated",
      category_id: null,
      subcategory_id: null,
      enabled: true,
    });
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "rule-id");
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/automations");
  });

  it("deletes only the requested rule in the verified household", async () => {
    configureActionClient();

    await expect(actions.deleteAutomationRule("rule-id")).resolves.toEqual({ status: "success" });

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.deleteEqId).toHaveBeenCalledWith("id", "rule-id");
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("updates only enabled through the toggle action", async () => {
    configureActionClient();

    await expect(actions.setAutomationRuleEnabled("11111111-1111-4111-8111-111111111111", false)).resolves.toEqual({
      status: "success",
      data: { enabled: "false" },
    });
    expect(mocks.update).toHaveBeenCalledWith({ enabled: false });
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });

  it("reorders through the existing household-scoped RPC", async () => {
    configureActionClient();
    const orderedRuleIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];

    await expect(actions.reorderAutomationRules(orderedRuleIds)).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("reorder_automation_rules", {
      target_household_id: "household-id",
      ordered_rule_ids: orderedRuleIds,
    });
  });

  it("rejects a confirmed application when its fingerprint does not match the server preview", async () => {
    configureActionClient();

    await expect(actions.applyAutomationResults("stale-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("applies the server-derived preview through the atomic RPC", async () => {
    configureActionClient();

    await expect(actions.applyAutomationResults("current-fingerprint")).resolves.toEqual({
      status: "success",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_automation_results", {
      target_household_id: "household-id",
      changes: previewChanges,
      expected_rule_set: ruleSet,
    });
  });

  it("applies one server-derived preview change through the same atomic RPC", async () => {
    configureActionClient();
    mocks.getMerchantAutomationRulesPage.mockResolvedValue({
      count: 1,
      rules: [],
      destinations: [],
      preview: { ...automationPreview, changes: [...previewChanges, secondPreviewChange], fingerprint: "multi-fingerprint" },
    });

    await expect(actions.applyAutomationResult("multi-fingerprint", secondPreviewChange.id)).resolves.toEqual({ status: "success" });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_automation_results", {
      target_household_id: "household-id",
      changes: [secondPreviewChange],
      expected_rule_set: ruleSet,
    });
  });

  it("applies the complete server-derived preview in one atomic batch", async () => {
    configureActionClient();
    mocks.getMerchantAutomationRulesPage.mockResolvedValue({
      count: 1,
      rules: [],
      destinations: [],
      preview: { ...automationPreview, changes: [...previewChanges, secondPreviewChange], fingerprint: "multi-fingerprint" },
    });

    await expect(actions.applyAutomationResults("multi-fingerprint")).resolves.toEqual({
      status: "success",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_automation_results", {
      target_household_id: "household-id",
      changes: [...previewChanges, secondPreviewChange],
      expected_rule_set: ruleSet,
    });
  });

  it("rejects an empty server preview before calling the RPC", async () => {
    configureActionClient();
    mocks.getMerchantAutomationRulesPage.mockResolvedValue({
      count: 1,
      rules: [],
      destinations: [],
      preview: { ...automationPreview, changes: [] },
    });

    await expect(actions.applyAutomationResults("current-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a safe error when the server preview cannot load", async () => {
    configureActionClient();
    mocks.getMerchantAutomationRulesPage.mockRejectedValue(new Error("Database unavailable"));

    await expect(actions.applyAutomationResults("current-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "Unable to apply automation changes. Please try again.",
      fieldErrors: {},
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe stale-preview error from the atomic RPC", async () => {
    configureActionClient();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Automation preview is stale" } });
    await expect(actions.applyAutomationResults("current-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic RPC error without revalidating", async () => {
    configureActionClient();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Database unavailable" } });

    await expect(actions.applyAutomationResults("current-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "Unable to apply automation changes. Please try again.",
      fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
