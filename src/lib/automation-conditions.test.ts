import { describe, expect, it } from "vitest";

import {
  compatibilityPattern,
  describeConditionGroup,
  evaluateAutomationConditionGroup,
  groupFromLegacyPattern,
  parseAutomationConditionGroup,
  preserveConditionConnectorPositions,
  type AutomationCondition,
  type AutomationConditionGroup,
} from "./automation-conditions";

describe("automation condition groups", () => {
  it("matches every condition in an AND group", () => {
    const group: AutomationConditionGroup = {
      logic: "and",
      conditions: [
        { field: "merchant", operator: "contains", value: "market" },
        { field: "note", operator: "starts_with", value: "weekly" },
        { field: "amount", operator: "less_than_or_equal", value: 120 },
      ],
    };

    expect(evaluateAutomationConditionGroup(group, { merchant: "Fresh Market", note: "Weekly shop", amount: 120 })).toBe(true);
    expect(evaluateAutomationConditionGroup(group, { merchant: "Fresh Market", note: "One-off", amount: 120 })).toBe(false);
  });

  it("matches at least one condition in an OR group with numeric comparisons", () => {
    const group: AutomationConditionGroup = {
      logic: "or",
      conditions: [
        { field: "amount", operator: "greater_than", value: 500 },
        { field: "note", operator: "equals", value: "refund" },
      ],
    };

    expect(evaluateAutomationConditionGroup(group, { merchant: "Shop", note: "other", amount: 501 })).toBe(true);
    expect(evaluateAutomationConditionGroup(group, { merchant: "Shop", note: "REFUND", amount: 10 })).toBe(true);
    expect(evaluateAutomationConditionGroup(group, { merchant: "Shop", note: "other", amount: 10 })).toBe(false);
  });

  it("matches a case-insensitive regex against a Note", () => {
    const group: AutomationConditionGroup = {
      conditions: [{ field: "note", operator: "advanced", value: "^(weekly|monthly) shop$" }],
    };

    expect(evaluateAutomationConditionGroup(group, { merchant: "Market", note: "Monthly Shop", amount: 40 })).toBe(true);
    expect(evaluateAutomationConditionGroup(group, { merchant: "Market", note: "One-off shop", amount: 40 })).toBe(false);
  });

  it("evaluates each later condition with its own connector from left to right", () => {
    const group = {
      logic: "and",
      conditions: [
        { field: "merchant", operator: "contains", value: "market" },
        { connector: "and", field: "amount", operator: "greater_than", value: 100 },
        { connector: "or", field: "note", operator: "equals", value: "refund" },
      ],
    } as unknown as AutomationConditionGroup;

    expect(evaluateAutomationConditionGroup(group, { merchant: "Market", note: "refund", amount: 20 })).toBe(true);
  });

  it("describes fields and operators without exposing the storage format", () => {
    expect(
      describeConditionGroup({
        logic: "or",
        conditions: [
          { field: "merchant", operator: "contains", value: "Cafe" },
          { field: "amount", operator: "greater_than_or_equal", value: 100 },
        ],
      }),
    ).toBe("Merchant Contains “Cafe” OR Amount At least “100”");
  });

  it("falls back to the lossless legacy merchant pattern", () => {
    const group = groupFromLegacyPattern("^Super-Pharm$");
    expect(group).toEqual({ logic: "and", conditions: [{ field: "merchant", operator: "equals", value: "Super-Pharm" }] });
    expect(compatibilityPattern(group)).toBe("^Super-Pharm$");
  });

  it.each([
    [{ conditions: [{ field: "merchant", operator: "contains", value: "Cafe" }] }, "Cafe"],
    [{ conditions: [{ field: "note", operator: "contains", value: "weekly" }] }, "__conditions__"],
    [
      {
        conditions: [
          { field: "merchant", operator: "contains", value: "Cafe" },
          { connector: "and", field: "note", operator: "contains", value: "weekly" },
        ],
      },
      "__conditions__",
    ],
  ] as const)("derives the compatibility pattern without changing condition storage", (group, pattern) => {
    expect(compatibilityPattern(group as unknown as AutomationConditionGroup)).toBe(pattern);
  });

  it.each([
    ["merchant", "contains", "Market"],
    ["merchant", "advanced", "^(market|shop)$"],
    ["note", "equals", "Weekly"],
    ["note", "advanced", "^(weekly|monthly)$"],
  ] as const)("parses a valid %s %s condition", (field, operator, value) => {
    expect(parseAutomationConditionGroup({ conditions: [{ field, operator, value }] })).toEqual({
      success: true,
      data: { conditions: [{ field, operator, value }] },
    });
  });

  it.each([
    ["equals", 10],
    ["not_equals", 10],
    ["greater_than", 10],
    ["greater_than_or_equal", 10],
    ["less_than", 10],
    ["less_than_or_equal", 10],
  ] as const)("parses the amount %s operator", (operator, value) => {
    expect(parseAutomationConditionGroup({ conditions: [{ field: "amount", operator, value }] }).success).toBe(true);
  });

  it("returns a field-level issue for invalid RE2", () => {
    const result = parseAutomationConditionGroup({ conditions: [{ field: "note", operator: "advanced", value: "[" }] });

    expect(result).toEqual({
      success: false,
      issues: [{ path: ["conditions", 0, "value"], message: "Enter a valid RE2 pattern." }],
    });
  });

  it("enforces condition limits, connector positions, and field lengths", () => {
    const cases = [
      { conditions: [] },
      { conditions: Array.from({ length: 9 }, () => ({ field: "note", operator: "contains", value: "x" })) },
      { conditions: [{ connector: "and", field: "note", operator: "contains", value: "x" }] },
      {
        conditions: [
          { field: "note", operator: "contains", value: "x" },
          { field: "note", operator: "contains", value: "y" },
        ],
      },
      { conditions: [{ field: "merchant", operator: "contains", value: "x".repeat(201) }] },
      { conditions: [{ field: "note", operator: "contains", value: "x".repeat(501) }] },
    ];

    expect(cases.map((value) => parseAutomationConditionGroup(value).success)).toEqual([false, false, false, false, false, false]);
    expect(
      parseAutomationConditionGroup({
        logic: "or",
        conditions: [
          { field: "note", operator: "contains", value: "x" },
          { field: "note", operator: "contains", value: "y" },
        ],
      }).success,
    ).toBe(true);
  });

  it("preserves connector slots when conditions are reordered or removed", () => {
    const a = { field: "merchant", operator: "contains", value: "a" } satisfies AutomationCondition;
    const b = { connector: "and", field: "note", operator: "contains", value: "b" } satisfies AutomationCondition;
    const c = { connector: "or", field: "amount", operator: "greater_than", value: 3 } satisfies AutomationCondition;

    expect(preserveConditionConnectorPositions([a, b, c], [c, a, b])).toEqual([
      { field: "amount", operator: "greater_than", value: 3 },
      { connector: "and", field: "merchant", operator: "contains", value: "a" },
      { connector: "or", field: "note", operator: "contains", value: "b" },
    ]);
    expect(preserveConditionConnectorPositions([a, b, c], [a, c])).toEqual([
      a,
      { connector: "and", field: "amount", operator: "greater_than", value: 3 },
    ]);
  });
});
