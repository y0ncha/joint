import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
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

function formData(values: Record<string, string>) {
  const input = new FormData();
  Object.entries(values).forEach(([key, value]) => input.set(key, value));
  return input;
}

function normalizeRuleForm(overrides: Record<string, string> = {}) {
  return formData({ action: "normalize_merchant", pattern: "shop", replacement: "Shop", enabled: "true", ...overrides });
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
  return { lastRuleQuery };
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
  });

  it("rejects an invalid RE2 pattern before inserting a rule", async () => {
    configureActionClient();

    await expect(actions.createAutomationRule(normalizeRuleForm({ pattern: "(" }))).resolves.toMatchObject({
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

  it("updates and deletes only the requested rule in the verified household", async () => {
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

    await expect(actions.deleteAutomationRule("rule-id")).resolves.toEqual({ status: "success" });
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/automations");
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

  it("rejects a confirmed application when its fingerprint does not match its changes", async () => {
    configureActionClient();
    const changes = [
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

    await expect(actions.applyAutomationResults(changes, ruleSet, "stale-fingerprint")).resolves.toEqual({
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("applies a confirmed preview through the atomic RPC", async () => {
    configureActionClient();
    const changes = [
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
    const { fingerprintAutomationPreview } = await import("@/lib/merchant-automations");

    await expect(actions.applyAutomationResults(changes, ruleSet, fingerprintAutomationPreview(changes, ruleSet))).resolves.toEqual({
      status: "success",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_automation_results", {
      target_household_id: "household-id",
      changes,
      expected_rule_set: ruleSet,
    });
  });

  it("returns a safe stale-preview error from the atomic RPC", async () => {
    configureActionClient();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Automation preview is stale" } });
    const changes = [
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
    const { fingerprintAutomationPreview } = await import("@/lib/merchant-automations");

    await expect(actions.applyAutomationResults(changes, ruleSet, fingerprintAutomationPreview(changes, ruleSet))).resolves.toEqual({
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
