import { RE2JS } from "re2js";
import { z } from "zod";

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

const amountConditionOperatorSymbols: Record<AutomationConditionAmountOperator, string> = {
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  greater_than_or_equal: "≥",
  less_than: "<",
  less_than_or_equal: "≤",
};

export const legacyConditionGroup = (pattern: string): AutomationConditionGroup => ({
  logic: "and",
  conditions: [{ field: "merchant", operator: "advanced", value: pattern.trim() }],
});

const connectorSchema = z.enum(["and", "or"]);
const textOperatorSchema = z.enum(["contains", "equals", "starts_with", "ends_with", "advanced"]);
const amountOperatorSchema = z.enum(["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal"]);
const merchantConditionSchema = z.object({
  connector: connectorSchema.optional(),
  field: z.literal("merchant"),
  operator: textOperatorSchema,
  value: z.string().trim().min(1).max(200),
});
const noteConditionSchema = z.object({
  connector: connectorSchema.optional(),
  field: z.literal("note"),
  operator: textOperatorSchema,
  value: z.string().trim().min(1).max(500),
});
const amountConditionSchema = z.object({
  connector: connectorSchema.optional(),
  field: z.literal("amount"),
  operator: amountOperatorSchema,
  value: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().finite().min(0)),
});
const conditionGroupSchema = z
  .object({
    logic: connectorSchema.optional(),
    conditions: z
      .array(z.discriminatedUnion("field", [merchantConditionSchema, noteConditionSchema, amountConditionSchema]))
      .min(1)
      .max(8),
  })
  .superRefine((group, context) => {
    group.conditions.forEach((condition, index) => {
      if (index === 0 && condition.connector !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["conditions", index, "connector"],
          message: "The first condition cannot have a connector.",
        });
      }
      if (index > 0 && group.logic === undefined && condition.connector === undefined) {
        context.addIssue({ code: "custom", path: ["conditions", index, "connector"], message: "Choose AND or OR." });
      }
      if (condition.field !== "amount" && condition.operator === "advanced") {
        try {
          RE2JS.compile(condition.value);
        } catch {
          context.addIssue({
            code: "custom",
            path: ["conditions", index, "value"],
            message: "Enter a valid RE2 pattern.",
          });
        }
      }
    });
  });

export type AutomationConditionParseIssue = { path: PropertyKey[]; message: string };
export type AutomationConditionParseResult =
  { success: true; data: AutomationConditionGroup } | { success: false; issues: AutomationConditionParseIssue[] };

export function parseAutomationConditionGroup(value: unknown): AutomationConditionParseResult {
  const result = conditionGroupSchema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
  };
}

export function decodeAutomationConditions(value: unknown, pattern: string): AutomationConditionGroup {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      const result = parseAutomationConditionGroup(parsed);
      if (result.success) return result.data;
    } catch {
      // Fall through to the legacy merchant pattern.
    }
  }
  const result = parseAutomationConditionGroup(value);
  if (result.success) return result.data;
  return legacyConditionGroup(pattern);
}

export function preserveConditionConnectorPositions(
  previous: AutomationCondition[],
  reordered: AutomationCondition[],
): AutomationCondition[] {
  const connectors = previous.slice(1).map((condition) => condition.connector ?? "and");
  return reordered.map((condition, index) =>
    index === 0 ? { ...condition, connector: undefined } : { ...condition, connector: connectors[index - 1] ?? "and" },
  );
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
  if (condition.field === "amount") return `Amount ${amountConditionOperatorSymbols[condition.operator]} ${condition.value}`;
  const fieldLabel = condition.field === "merchant" ? "Merchant" : condition.field === "note" ? "Note" : "Amount";
  const operatorLabel =
    condition.operator === "advanced"
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
