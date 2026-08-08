import { RE2JS } from "re2js";

import { decodeMerchantPattern, encodeMerchantPattern, type MerchantMatchMode } from "@/lib/merchant-pattern";

export type AutomationConditionLogic = "and" | "or";
export type AutomationConditionConnector = AutomationConditionLogic;
export type AutomationConditionTextField = "merchant" | "note";
export type AutomationConditionField = AutomationConditionTextField | "amount";
export type AutomationConditionTextOperator = MerchantMatchMode;
export type AutomationConditionAmountOperator =
  "equals" | "not_equals" | "greater_than" | "greater_than_or_equal" | "less_than" | "less_than_or_equal";

export type AutomationTextCondition = {
  connector?: AutomationConditionConnector;
  field: AutomationConditionTextField;
  operator: AutomationConditionTextOperator | "advanced";
  value: string;
};

export type AutomationAmountCondition = {
  connector?: AutomationConditionConnector;
  field: "amount";
  operator: AutomationConditionAmountOperator;
  value: number;
};

export type AutomationCondition = AutomationTextCondition | AutomationAmountCondition;

export type AutomationConditionGroup = {
  /** Legacy group-level connector for rules saved before per-row connectors. */
  logic?: AutomationConditionLogic;
  conditions: AutomationCondition[];
};

export const conditionLogicOptions = [
  { value: "and" as const, label: "Match all (AND)" },
  { value: "or" as const, label: "Match any (OR)" },
];

export const conditionConnectorOptions = [
  { value: "and" as const, label: "AND" },
  { value: "or" as const, label: "OR" },
];

export const textConditionFieldOptions = [
  { value: "merchant" as const, label: "Merchant" },
  { value: "note" as const, label: "Note" },
];

export const textConditionOperatorOptions = [
  { value: "contains" as const, label: "Contains" },
  { value: "equals" as const, label: "Is exactly" },
  { value: "starts_with" as const, label: "Starts with" },
  { value: "ends_with" as const, label: "Ends with" },
  { value: "advanced" as const, label: "Matches regex" },
];

export const amountConditionOperatorOptions = [
  { value: "equals" as const, label: "Is exactly" },
  { value: "not_equals" as const, label: "Is not" },
  { value: "greater_than" as const, label: "Greater than" },
  { value: "greater_than_or_equal" as const, label: "At least" },
  { value: "less_than" as const, label: "Less than" },
  { value: "less_than_or_equal" as const, label: "At most" },
];

export const legacyConditionGroup = (pattern: string): AutomationConditionGroup => ({
  logic: "and",
  conditions: [{ field: "merchant", operator: "advanced", value: pattern.trim() }],
});

function isTextOperator(value: unknown): value is AutomationTextCondition["operator"] {
  return value === "contains" || value === "equals" || value === "starts_with" || value === "ends_with" || value === "advanced";
}

function isAmountOperator(value: unknown): value is AutomationConditionAmountOperator {
  return (
    value === "equals" ||
    value === "not_equals" ||
    value === "greater_than" ||
    value === "greater_than_or_equal" ||
    value === "less_than" ||
    value === "less_than_or_equal"
  );
}

export function isAutomationConditionGroup(value: unknown): value is AutomationConditionGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Partial<AutomationConditionGroup>;
  if (
    (group.logic !== undefined && group.logic !== "and" && group.logic !== "or") ||
    !Array.isArray(group.conditions) ||
    group.conditions.length < 1 ||
    group.conditions.length > 8
  )
    return false;
  return group.conditions.every((condition, index) => {
    if (!condition || typeof condition !== "object") return false;
    const candidate = condition as Partial<AutomationCondition>;
    if (
      index === 0
        ? candidate.connector !== undefined
        : candidate.connector !== undefined && candidate.connector !== "and" && candidate.connector !== "or"
    )
      return false;
    if (index > 0 && group.logic === undefined && candidate.connector === undefined) return false;
    if (candidate.field === "amount") return isAmountOperator(candidate.operator) && typeof candidate.value === "number";
    return (
      (candidate.field === "merchant" || candidate.field === "note") &&
      isTextOperator(candidate.operator) &&
      typeof candidate.value === "string" &&
      candidate.value.trim().length > 0
    );
  });
}

export function decodeAutomationConditions(value: unknown, pattern: string): AutomationConditionGroup {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (isAutomationConditionGroup(parsed)) return parsed;
    } catch {
      // Fall through to the legacy merchant pattern.
    }
  }
  if (isAutomationConditionGroup(value)) return value;
  return legacyConditionGroup(pattern);
}

export function encodeAutomationConditions(group: AutomationConditionGroup) {
  return JSON.stringify(group);
}

export function compatibilityPattern(group: AutomationConditionGroup) {
  if (group.conditions.length !== 1) return "__conditions__";
  const merchantCondition = group.conditions.find((condition) => condition.field === "merchant");
  if (!merchantCondition) return "__conditions__";
  if (merchantCondition.operator === "advanced") return merchantCondition.value.trim();
  const pattern = encodeMerchantPattern(merchantCondition.operator as MerchantMatchMode, String(merchantCondition.value));
  return pattern.length <= 200 ? pattern : "__conditions__";
}

export function conditionDisplayLabel(condition: AutomationCondition) {
  const fieldLabel = condition.field === "merchant" ? "Merchant" : condition.field === "note" ? "Note" : "Amount";
  const operatorLabel =
    condition.field === "amount"
      ? amountConditionOperatorOptions.find((option) => option.value === condition.operator)?.label
      : condition.operator === "advanced"
        ? "Matches regex"
        : textConditionOperatorOptions.find((option) => option.value === condition.operator)?.label;
  return `${fieldLabel} ${operatorLabel ?? condition.operator} “${condition.value}”`;
}

export function connectorForCondition(group: AutomationConditionGroup, index: number): AutomationConditionConnector | undefined {
  if (index === 0) return undefined;
  return group.conditions[index]?.connector ?? group.logic ?? "and";
}

export function describeConditionGroup(group: AutomationConditionGroup) {
  return group.conditions
    .map((condition, index) =>
      index === 0
        ? conditionDisplayLabel(condition)
        : `${connectorForCondition(group, index)?.toUpperCase()} ${conditionDisplayLabel(condition)}`,
    )
    .join(" ");
}

export function groupFromLegacyPattern(pattern: string): AutomationConditionGroup {
  const decoded = decodeMerchantPattern(pattern);
  return {
    logic: "and",
    conditions: [{ field: "merchant", operator: decoded.mode, value: decoded.value }],
  };
}

export function evaluateAutomationCondition(condition: AutomationCondition, input: { merchant: string; note: string; amount: number }) {
  if (condition.field === "amount") {
    const value = Math.round(input.amount * 100);
    const expected = Math.round(condition.value * 100);
    switch (condition.operator) {
      case "equals":
        return value === expected;
      case "not_equals":
        return value !== expected;
      case "greater_than":
        return value > expected;
      case "greater_than_or_equal":
        return value >= expected;
      case "less_than":
        return value < expected;
      case "less_than_or_equal":
        return value <= expected;
    }
  }

  const actual = (condition.field === "merchant" ? input.merchant : input.note).trim().toLocaleLowerCase();
  const expected = condition.value.trim().toLocaleLowerCase();
  if (condition.operator === "advanced") return RE2JS.compile(condition.value.trim(), RE2JS.CASE_INSENSITIVE).test(actual);
  if (condition.operator === "contains") return actual.includes(expected);
  if (condition.operator === "equals") return actual === expected;
  if (condition.operator === "starts_with") return actual.startsWith(expected);
  return actual.endsWith(expected);
}

export function evaluateAutomationConditionGroup(
  group: AutomationConditionGroup,
  input: { merchant: string; note: string; amount: number },
) {
  const [firstCondition, ...remainingConditions] = group.conditions;
  if (!firstCondition) return false;
  return remainingConditions.reduce(
    (result, condition, index) => {
      const matches = evaluateAutomationCondition(condition, input);
      return connectorForCondition(group, index + 1) === "or" ? result || matches : result && matches;
    },
    evaluateAutomationCondition(firstCondition, input),
  );
}
