import { RE2JS } from "re2js";

export type AutomationAction = "normalize_merchant" | "assign_category";

export type MerchantAutomationRule = {
  id: string;
  action: AutomationAction;
  pattern: string;
  replacement?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  destinationKind?: "income" | "expense";
  enabled: boolean;
  position: number;
  createdAt?: string;
};

type AutomationInput = {
  merchant: string;
  kind: "income" | "expense";
  categoryId: string | null;
  subcategoryId: string | null;
};

type AutomationConflict = { action: AutomationAction; winnerId: string; shadowedRuleIds: string[] };

export type MerchantAutomationResult = {
  merchant: string;
  categoryId: string | null;
  subcategoryId: string | null;
  appliedRuleIds: string[];
  conflicts: AutomationConflict[];
};

export function compileMerchantPattern(pattern: string) {
  return RE2JS.compile(pattern.trim(), RE2JS.CASE_INSENSITIVE);
}

export function evaluateMerchantAutomations(input: AutomationInput, rules: MerchantAutomationRule[]): MerchantAutomationResult {
  const merchant = input.merchant.trim();
  const matching = rules
    .filter((rule) => rule.enabled && rule.pattern.trim())
    .sort((left, right) => left.position - right.position || (left.createdAt ?? "").localeCompare(right.createdAt ?? "") || left.id.localeCompare(right.id))
    .filter((rule) => compileMerchantPattern(rule.pattern).test(merchant));
  const normalizeRules = matching.filter((rule) => rule.action === "normalize_merchant");
  const categoryRules = matching.filter(
    (rule) => rule.action === "assign_category" && rule.destinationKind === input.kind && !input.categoryId && !input.subcategoryId,
  );
  const winnerByAction = [normalizeRules[0], categoryRules[0]].filter((rule): rule is MerchantAutomationRule => Boolean(rule));
  const normalization = normalizeRules[0];
  const assignment = categoryRules[0];
  const conflicts: AutomationConflict[] = [];
  if (normalization && normalizeRules.length > 1)
    conflicts.push({ action: "normalize_merchant", winnerId: normalization.id, shadowedRuleIds: normalizeRules.slice(1).map((rule) => rule.id) });
  if (assignment && categoryRules.length > 1)
    conflicts.push({ action: "assign_category", winnerId: assignment.id, shadowedRuleIds: categoryRules.slice(1).map((rule) => rule.id) });

  return {
    merchant: normalization?.replacement?.trim() || merchant,
    categoryId: assignment?.categoryId ?? input.categoryId,
    subcategoryId: assignment?.subcategoryId ?? input.subcategoryId,
    appliedRuleIds: winnerByAction.map((rule) => rule.id),
    conflicts,
  };
}
