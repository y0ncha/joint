import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionReducers: [] as Array<(state: unknown, formData: FormData) => unknown>,
  applyAutomationResults: vi.fn(),
  createAutomationRule: vi.fn(),
  setAutomationRuleEnabled: vi.fn(),
  sheetSides: [] as Array<string | undefined>,
  updateAutomationRule: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: (state: unknown, formData: FormData) => unknown) => {
      mocks.actionReducers.push(action);
      return [null, () => {}, false] as const;
    },
  };
});
vi.mock("@/app/actions/merchant-automations", () => ({
  applyAutomationResults: mocks.applyAutomationResults,
  createAutomationRule: mocks.createAutomationRule,
  deleteAutomationRule: vi.fn(),
  reorderAutomationRules: vi.fn(),
  setAutomationRuleEnabled: mocks.setAutomationRuleEnabled,
  updateAutomationRule: mocks.updateAutomationRule,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ side }: { side?: string }) => {
    mocks.sheetSides.push(side);
    return null;
  },
  SheetDescription: ({ children }: { children: ReactNode }) => children,
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
  SheetTrigger: ({ children }: { children: ReactNode }) => children,
}));

const workspaceModule = await import("./automation-rules-workspace").catch(() => null);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actionReducers.length = 0;
  mocks.sheetSides.length = 0;
  mocks.applyAutomationResults.mockResolvedValue({ status: "success" });
  mocks.createAutomationRule.mockResolvedValue({ status: "success" });
  mocks.setAutomationRuleEnabled.mockResolvedValue({ status: "success", data: { enabled: "false" } });
  mocks.updateAutomationRule.mockResolvedValue({ status: "success" });
});

it("renders ordered atomic automation rules with conflict guidance", () => {
  const markup = workspaceModule
    ? renderToStaticMarkup(
        <workspaceModule.AutomationRulesWorkspace
          count={3}
          destinations={[
            {
              categoryId: null,
              subcategoryId: "cafe-id",
              label: "Expense → Food → Cafe",
              kind: "expense",
              color: "#dcece3",
              icon: "utensils",
            },
          ]}
          preview={{
            changes: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                merchant: "Aroma",
                category_id: null,
                subcategory_id: "cafe-id",
                expected_updated_at: "2026-08-07T10:00:00Z",
                expected_merchant: "ארומה",
                expected_category_id: null,
                expected_subcategory_id: null,
              },
            ],
            conflicts: [
              {
                action: "normalize_merchant",
                winnerId: "normalize",
                shadowedRuleIds: ["normalize-shadowed"],
                transactionCount: 1,
              },
            ],
            fingerprint: "preview-fingerprint",
            ruleSet: [],
          }}
          rules={[
            { id: "normalize", action: "normalize_merchant", pattern: "ארומה", replacement: "Aroma", enabled: true, position: 0 },
            {
              id: "category",
              action: "assign_category",
              pattern: "ארומה",
              categoryId: null,
              subcategoryId: "cafe-id",
              enabled: true,
              position: 1,
            },
            {
              id: "normalize-shadowed",
              action: "normalize_merchant",
              pattern: "אר",
              replacement: "Aroma Israel",
              enabled: true,
              position: 2,
            },
          ]}
        />,
      )
    : "";

  expect(markup).toContain("Automations");
  expect(markup).toContain("Priority decides which matching rule wins.");
  expect(markup).toContain("Normalize merchant");
  expect(markup).toContain("Assign category");
  expect(markup).toContain("Aroma");
  expect(markup).toContain("Expense → Food → Cafe");
  expect(markup).toContain('aria-label="Add rule"');
  expect(markup).not.toContain(">Add rule<");
  expect(markup).toContain('aria-label="Reorder Normalize merchant rule"');
  expect(markup).toContain('aria-label="Edit Normalize merchant rule"');
  expect(markup).toContain('aria-label="Disable Normalize merchant rule"');
  expect(markup).toContain('aria-label="Delete Normalize merchant rule"');
  expect(markup).toContain("1 existing transaction");
  expect(markup).toContain("1 priority conflict");
  expect(markup).toContain("ארומה wins over אר for 1 transaction.");
  expect(markup).toContain("Review and apply");
});

it("renders add and edit rule forms in right-side sheets", () => {
  if (!workspaceModule?.AutomationRulesWorkspace) throw new Error("AutomationRulesWorkspace is unavailable.");
  renderToStaticMarkup(
    <workspaceModule.AutomationRulesWorkspace
      count={1}
      destinations={[]}
      preview={{ changes: [], conflicts: [], fingerprint: "preview-fingerprint", ruleSet: [] }}
      rules={[
        {
          id: "rule-id",
          action: "normalize_merchant",
          pattern: "shop",
          replacement: "Shop",
          enabled: true,
          position: 0,
        },
      ]}
    />,
  );

  expect(mocks.sheetSides).toEqual(["right", "right"]);
});

it("submits create and edit rule forms through the existing Server Actions", async () => {
  if (!workspaceModule?.AutomationRuleForm) throw new Error("AutomationRuleForm is unavailable.");
  const destination = {
    categoryId: null,
    subcategoryId: "cafe-id",
    label: "Expense → Food → Cafe",
    kind: "expense" as const,
    color: "#dcece3",
    icon: "utensils",
  };

  const createMarkup = renderToStaticMarkup(<workspaceModule.AutomationRuleForm destinations={[destination]} />);
  expect(createMarkup).toContain('name="action"');
  expect(createMarkup).toContain('name="pattern"');
  expect(createMarkup).toContain('name="replacement"');
  expect(createMarkup).toContain('name="categoryId"');
  expect(createMarkup).toContain('name="subcategoryId"');
  expect(createMarkup).toContain('name="enabled"');
  expect(createMarkup).toMatch(/<input(?=[^>]*name="pattern")(?=[^>]*min-h-11)[^>]*>/);
  expect(createMarkup).toMatch(/<input(?=[^>]*name="replacement")(?=[^>]*min-h-11)[^>]*>/);

  const createData = new FormData();
  createData.set("action", "normalize_merchant");
  createData.set("pattern", "shop");
  createData.set("replacement", "Shop");
  createData.set("categoryId", "");
  createData.set("subcategoryId", "");
  createData.set("enabled", "true");
  await mocks.actionReducers[0](null, createData);
  expect(mocks.createAutomationRule).toHaveBeenCalledWith(createData);

  renderToStaticMarkup(
    <workspaceModule.AutomationRuleForm
      destinations={[destination]}
      rule={{
        id: "rule-id",
        action: "assign_category",
        pattern: "shop",
        categoryId: null,
        subcategoryId: "cafe-id",
        enabled: true,
        position: 0,
      }}
    />,
  );
  const editData = new FormData();
  editData.set("action", "assign_category");
  editData.set("pattern", "shop");
  editData.set("replacement", "");
  editData.set("categoryId", "");
  editData.set("subcategoryId", "cafe-id");
  editData.set("enabled", "true");
  await mocks.actionReducers[1](null, editData);
  expect(mocks.updateAutomationRule).toHaveBeenCalledWith("rule-id", editData);
});

it("preserves the submitted toggle target for success feedback after revalidation", async () => {
  if (!workspaceModule?.AutomationRulesWorkspace) throw new Error("AutomationRulesWorkspace is unavailable.");
  renderToStaticMarkup(
    <workspaceModule.AutomationRulesWorkspace
      count={1}
      destinations={[]}
      preview={{ changes: [], conflicts: [], fingerprint: "preview-fingerprint", ruleSet: [] }}
      rules={[
        {
          id: "rule-id",
          action: "normalize_merchant",
          pattern: "shop",
          replacement: "Shop",
          enabled: true,
          position: 0,
        },
      ]}
    />,
  );

  const toggleData = new FormData();
  await expect(mocks.actionReducers[0](null, toggleData)).resolves.toEqual({
    status: "success",
    data: { enabled: "false" },
  });
  expect(mocks.setAutomationRuleEnabled).toHaveBeenCalledWith("rule-id", false);
  expect(mocks.updateAutomationRule).not.toHaveBeenCalled();
});

it("submits the reviewed preview fingerprint through the atomic apply action", async () => {
  if (!workspaceModule?.ApplyPreviewControl) throw new Error("ApplyPreviewControl is unavailable.");
  const changes = [
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
  ];
  const ruleSet = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      action: "normalize_merchant" as const,
      pattern: "shop",
      replacement: "Shop",
      category_id: null,
      subcategory_id: null,
      enabled: true,
      position: 0,
    },
  ];

  const markup = renderToStaticMarkup(
    <workspaceModule.ApplyPreviewControl
      destinations={[]}
      disabled
      preview={{ changes, conflicts: [], fingerprint: "preview-fingerprint", ruleSet }}
    />,
  );
  expect(markup).toContain("Review and apply");
  expect(markup).toContain('disabled=""');

  await mocks.actionReducers[0](null, new FormData());
  expect(mocks.applyAutomationResults).toHaveBeenCalledWith(changes, ruleSet, "preview-fingerprint");
});
