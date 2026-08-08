import { renderToStaticMarkup } from "react-dom/server";
import type { ChangeEventHandler, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: null as null | { status: "error"; formError: string; fieldErrors: Record<string, string> },
  actionReducers: [] as Array<(state: unknown, formData: FormData) => unknown>,
  applyAutomationResults: vi.fn(),
  createAutomationRule: vi.fn(),
  focus: vi.fn(),
  inputChanges: {} as Record<string, ChangeEventHandler<HTMLInputElement> | undefined>,
  matchValueChange: undefined as ChangeEventHandler<HTMLInputElement> | undefined,
  runEffects: false,
  selectChanges: [] as Array<{ value?: string; onValueChange?: (value: string) => void }>,
  setAutomationRuleEnabled: vi.fn(),
  sheetSides: [] as Array<string | undefined>,
  state: [] as unknown[],
  stateIndex: 0,
  updateAutomationRule: vi.fn(),
  useFocusableRef: false,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: (state: unknown, formData: FormData) => unknown) => {
      mocks.actionReducers.push(action);
      return [mocks.actionState, () => {}, false] as const;
    },
    useEffect: (effect: () => void, dependencies: readonly unknown[]) =>
      mocks.runEffects ? effect() : actual.useEffect(effect, dependencies),
    useRef: (initialValue: unknown) => (mocks.useFocusableRef ? { current: { focus: mocks.focus } } : actual.useRef(initialValue)),
    useState: (initialState: unknown | (() => unknown)) => {
      const index = mocks.stateIndex++;
      if (!(index in mocks.state)) mocks.state[index] = typeof initialState === "function" ? initialState() : initialState;
      return [
        mocks.state[index],
        (nextState: unknown | ((current: unknown) => unknown)) => {
          mocks.state[index] = typeof nextState === "function" ? nextState(mocks.state[index]) : nextState;
        },
      ];
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
vi.mock("@/components/ui/input", () => ({
  Input: ({ onChange, ...props }: React.ComponentProps<"input">) => {
    if (props.name === "matchValue") mocks.matchValueChange = onChange;
    if (props.name) mocks.inputChanges[props.name] = onChange;
    return <input {...props} onChange={onChange} />;
  },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange?: (value: string) => void; value?: string }) => {
    mocks.selectChanges.push({ value, onValueChange });
    return <div data-select-value={value}>{children}</div>;
  },
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectGroup: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, className, value }: { children: ReactNode; className?: string; value: string }) => (
    <div className={className} data-select-item={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
  SelectValue: () => null,
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const workspaceModule = await import("./automation-rules-workspace").catch(() => null);

function renderRuleForm({
  preserveState = false,
  rule,
}: {
  preserveState?: boolean;
  rule?: {
    id: string;
    action: "normalize_merchant" | "assign_category";
    pattern: string;
    conditions?: {
      logic?: "and" | "or";
      conditions: Array<
        | {
            connector?: "and" | "or";
            field: "merchant" | "note";
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "advanced";
            value: string;
          }
        | {
            connector?: "and" | "or";
            field: "amount";
            operator: "equals" | "not_equals" | "greater_than" | "greater_than_or_equal" | "less_than" | "less_than_or_equal";
            value: number;
          }
      >;
    };
    replacement?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    enabled: boolean;
    position: number;
  };
} = {}) {
  if (!workspaceModule?.AutomationRuleForm) throw new Error("AutomationRuleForm is unavailable.");
  if (!preserveState) mocks.state = [];
  mocks.stateIndex = 0;
  mocks.matchValueChange = undefined;
  mocks.inputChanges = {};
  mocks.selectChanges.length = 0;
  return renderToStaticMarkup(<workspaceModule.AutomationRuleForm destinations={[]} rule={rule} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actionState = null;
  mocks.actionReducers.length = 0;
  mocks.matchValueChange = undefined;
  mocks.inputChanges = {};
  mocks.runEffects = false;
  mocks.selectChanges.length = 0;
  mocks.sheetSides.length = 0;
  mocks.state = [];
  mocks.stateIndex = 0;
  mocks.useFocusableRef = false;
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
              pattern: "אר.*",
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
  expect(markup).toContain("Contains “ארומה” → Rename merchant to “Aroma”");
  expect(markup).toContain("Contains “ארומה” → Assign category “Expense → Food → Cafe”");
  expect(markup).toContain("Matches regex “אר.*” → Rename merchant to “Aroma Israel”");
  expect(markup).toContain("Contains “ארומה” wins over Matches regex “אר.*” for 1 transaction.");
  expect(markup).toContain("Review and apply");
});

it("renders a default merchant match builder with a 44px regex option", () => {
  const markup = renderRuleForm();

  expect(markup).toContain("Delete transaction");
  expect(markup).toContain("Merchant match");
  expect(markup).toContain("Merchant text");
  expect(markup).toContain('aria-label="Reorder condition 1"');
  expect(markup).toContain("motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none");
  expect(markup).not.toContain("Merchant pattern");
  expect(markup).toMatch(/<input(?=[^>]*name="matchMode")(?=[^>]*value="contains")[^>]*>/);
  expect(markup).toMatch(/<input(?=[^>]*name="matchValue")(?=[^>]*class="h-11")[^>]*>/);
  expect(markup).toMatch(/<input(?=[^>]*name="pattern")(?=[^>]*type="hidden")(?=[^>]*value="")[^>]*>/);
  expect(markup).toMatch(/<button(?=[^>]*id="[^"]*-match-mode")(?=[^>]*class="w-full rounded-xl")[^>]*>/);
  expect(markup.match(/data-select-item="(?:contains|equals|starts_with|ends_with|advanced)"/g)).toHaveLength(5);
  expect(markup).toContain('class="min-h-11" data-select-item="contains">Contains');
  expect(markup).toContain('class="min-h-11" data-select-item="equals">Is exactly');
  expect(markup).toContain('class="min-h-11" data-select-item="starts_with">Starts with');
  expect(markup).toContain('class="min-h-11" data-select-item="ends_with">Ends with');
  expect(markup).toContain('class="min-h-11" data-select-item="advanced">Matches regex');
});

it("renders legacy condition groups as per-row connectors for merchant, note, and numeric amount without an editor enable toggle", () => {
  const markup = renderRuleForm({
    rule: {
      id: "condition-rule",
      action: "assign_category",
      pattern: "__conditions__",
      conditions: {
        logic: "or",
        conditions: [
          { field: "note", operator: "contains", value: "weekly" },
          { field: "amount", operator: "greater_than_or_equal", value: 250 },
        ],
      },
      categoryId: null,
      subcategoryId: "cafe-id",
      enabled: false,
      position: 0,
    },
  });

  expect(markup).not.toContain("Match all (AND)");
  expect(markup).not.toContain("Match any (OR)");
  expect(markup).toContain('aria-label="Condition 2 connector"');
  expect(markup.match(/data-slot="separator"/g)).toHaveLength(2);
  expect(markup).toContain('data-select-item="or">OR');
  expect(markup).toContain('data-select-item="merchant">Merchant');
  expect(markup).toContain('data-select-item="note">Note');
  expect(markup).toContain('data-select-item="amount">Amount');
  expect(markup).toContain('type="number"');
  expect(markup).toContain('name="conditions"');
  expect(markup).toContain("Add condition");
  expect(markup).not.toContain(">Enabled<");
});

it("renders a compact connector before each condition after the first", () => {
  const markup = renderRuleForm({
    rule: {
      id: "connector-rule",
      action: "assign_category",
      pattern: "__conditions__",
      conditions: {
        conditions: [
          { field: "merchant", operator: "contains", value: "Cafe" },
          { connector: "or", field: "amount", operator: "greater_than", value: 100 },
        ],
      },
      categoryId: null,
      subcategoryId: "cafe-id",
      enabled: true,
      position: 0,
    },
  });

  expect(markup).not.toContain("Match all (AND)");
  expect(markup).toContain('aria-label="Condition 2 connector"');
  expect(markup).toContain('data-select-item="and">AND');
  expect(markup).toContain('data-select-item="or">OR');
  expect(markup).toContain('type="number"');
});

it("renders each connector after the preceding condition so a promoted first row does not jump", () => {
  const markup = renderRuleForm({
    rule: {
      id: "connector-position-rule",
      action: "assign_category",
      pattern: "__conditions__",
      conditions: {
        conditions: [
          { field: "merchant", operator: "contains", value: "Cafe" },
          { connector: "or", field: "note", operator: "contains", value: "weekly" },
        ],
      },
      categoryId: null,
      subcategoryId: "cafe-id",
      enabled: true,
      position: 0,
    },
  });

  expect(markup.indexOf('aria-label="Reorder condition 1"')).toBeLessThan(markup.indexOf('aria-label="Condition 2 connector"'));
  expect(markup.indexOf('aria-label="Condition 2 connector"')).toBeLessThan(markup.indexOf('aria-label="Reorder condition 2"'));
  expect(markup).toContain('data-condition-row="1"');
  expect(markup).toContain('data-connector-after-condition="1"');
});

it("keeps operators with their conditions and normalizes a new first condition", () => {
  if (!workspaceModule?.normalizeConditionConnectors) {
    throw new Error("normalizeConditionConnectors is unavailable.");
  }

  const reordered = workspaceModule.normalizeConditionConnectors([
    { connector: "and" as const, field: "amount" as const, operator: "greater_than" as const, value: 100 },
    { field: "merchant" as const, operator: "contains" as const, value: "Cafe" },
    { connector: "or" as const, field: "note" as const, operator: "contains" as const, value: "weekly" },
  ]);

  expect(reordered).toEqual([
    { field: "amount", operator: "greater_than", value: 100, connector: undefined },
    { field: "merchant", operator: "contains", value: "Cafe", connector: "and" },
    { field: "note", operator: "contains", value: "weekly", connector: "or" },
  ]);
});

it("moves stable row identities with their condition and normalizes the first row", () => {
  if (!workspaceModule?.applyReorderedConditionRows) {
    throw new Error("applyReorderedConditionRows is unavailable.");
  }

  const reordered = workspaceModule.applyReorderedConditionRows([
    {
      id: "second",
      condition: { connector: "or" as const, field: "merchant" as const, operator: "contains" as const, value: "second" },
    },
    { id: "first", condition: { field: "merchant" as const, operator: "contains" as const, value: "first" } },
  ]);

  expect(reordered).toEqual([
    { id: "second", condition: { field: "merchant", operator: "contains", value: "second", connector: undefined } },
    { id: "first", condition: { field: "merchant", operator: "contains", value: "first", connector: "and" } },
  ]);
});

it("uses a gentle sortable transition when conditions settle into a new position", () => {
  expect(workspaceModule?.conditionRowTransition).toEqual({
    duration: 420,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    idle: true,
  });
});

it("updates only the value for the condition being edited", () => {
  const rule = {
    id: "edit-values-rule",
    action: "assign_category" as const,
    pattern: "__conditions__",
    conditions: {
      conditions: [
        { field: "note" as const, operator: "contains" as const, value: "weekly" },
        { connector: "or" as const, field: "amount" as const, operator: "greater_than" as const, value: 100 },
      ],
    },
    categoryId: null,
    subcategoryId: "cafe-id",
    enabled: true,
    position: 0,
  };

  renderRuleForm({ rule });
  mocks.inputChanges["condition-1-value"]?.({ target: { value: "200" } } as React.ChangeEvent<HTMLInputElement>);

  const markup = renderRuleForm({ preserveState: true, rule });
  expect(markup).toContain("&quot;value&quot;:&quot;weekly&quot;");
  expect(markup).toContain("&quot;value&quot;:200");
});

it("decodes canonical edit state and exposes Matches regex for a legacy rule", () => {
  const canonicalMarkup = renderRuleForm({
    rule: {
      id: "canonical-rule",
      action: "normalize_merchant",
      pattern: "^Super-Pharm$",
      replacement: "Super Pharm",
      enabled: true,
      position: 0,
    },
  });

  expect(canonicalMarkup).toMatch(/<input(?=[^>]*name="matchMode")(?=[^>]*value="equals")[^>]*>/);
  expect(canonicalMarkup).toMatch(/<input(?=[^>]*name="matchValue")(?=[^>]*value="Super-Pharm")[^>]*>/);
  expect(canonicalMarkup).toContain('class="min-h-11" data-select-item="advanced">Matches regex');

  const legacyMarkup = renderRuleForm({
    rule: {
      id: "legacy-rule",
      action: "normalize_merchant",
      pattern: "(Aroma|Cafe)",
      replacement: "Aroma",
      enabled: true,
      position: 0,
    },
  });

  expect(legacyMarkup).toMatch(/<input(?=[^>]*name="matchMode")(?=[^>]*value="advanced")[^>]*>/);
  expect(legacyMarkup).toMatch(/<input(?=[^>]*name="matchValue")(?=[^>]*value="\(Aroma\|Cafe\)")[^>]*>/);
  expect(legacyMarkup).toContain('class="min-h-11" data-select-item="advanced">Matches regex');
});

it("updates the compatibility pattern when merchant mode or text changes", () => {
  renderRuleForm();
  mocks.matchValueChange?.({ target: { value: "C++" } } as React.ChangeEvent<HTMLInputElement>);

  const textMarkup = renderRuleForm({ preserveState: true });
  expect(textMarkup).toMatch(/<input(?=[^>]*name="pattern")(?=[^>]*value="C\\\+\\\+")[^>]*>/);
  mocks.selectChanges.find((select) => select.value === "contains")?.onValueChange?.("ends_with");

  const modeMarkup = renderRuleForm({ preserveState: true });
  expect(modeMarkup).toMatch(/<input(?=[^>]*name="matchMode")(?=[^>]*value="ends_with")[^>]*>/);
  expect(modeMarkup).toMatch(/<input(?=[^>]*name="pattern")(?=[^>]*value="C\\\+\\\+\$")[^>]*>/);
});

it("focuses the visible Merchant text input for a pattern field error", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: { pattern: "Enter a merchant pattern." },
  };
  mocks.runEffects = true;
  mocks.useFocusableRef = true;

  const markup = renderRuleForm();

  expect(markup).toMatch(/<input(?=[^>]*name="matchValue")(?=[^>]*aria-invalid="true")[^>]*>/);
  expect(mocks.focus).toHaveBeenCalledTimes(1);
});

it("defers empty rule fields to the toast-backed Server Action validation", () => {
  const markup = renderRuleForm();

  expect(markup).toContain("noValidate");
  expect(markup).not.toContain('required=""');
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
  expect(createMarkup).toContain('name="matchMode"');
  expect(createMarkup).toContain('name="matchValue"');
  expect(createMarkup).toContain('name="pattern"');
  expect(createMarkup).toContain('name="replacement"');
  expect(createMarkup).toContain('name="categoryId"');
  expect(createMarkup).toContain('name="subcategoryId"');
  expect(createMarkup).toContain('name="enabled"');
  expect(createMarkup).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*w-full)[^>]*>Add rule<\/button>/);
  expect(createMarkup).toMatch(/<input(?=[^>]*name="matchValue")(?=[^>]*class="h-11")[^>]*>/);
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
  expect(mocks.applyAutomationResults).toHaveBeenCalledWith("preview-fingerprint");
});
