import { describe, expect, it } from "vitest";

import {
  compatibilityPattern,
  describeConditionGroup,
  evaluateAutomationConditionGroup,
  groupFromLegacyPattern,
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
});
