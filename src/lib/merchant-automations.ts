import { RE2JS } from "re2js";

import { getCurrentHouseholdContext } from "@/lib/household";

export type AutomationAction = "normalize_merchant" | "assign_category";
export type TransactionKind = "income" | "expense";

export type MerchantAutomationRule = {
  id: string;
  action: AutomationAction;
  pattern: string;
  replacement?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  destinationKind?: TransactionKind;
  enabled: boolean;
  position: number;
  createdAt?: string;
};

export type AutomationInput = {
  merchant: string;
  kind: TransactionKind;
  categoryId: string | null;
  subcategoryId: string | null;
};

export type AutomationConflict = { action: AutomationAction; winnerId: string; shadowedRuleIds: string[] };

export type MerchantAutomationResult = {
  merchant: string;
  categoryId: string | null;
  subcategoryId: string | null;
  appliedRuleIds: string[];
  conflicts: AutomationConflict[];
};

export type AutomationPreviewChange = {
  id: string;
  merchant: string;
  category_id: string | null;
  subcategory_id: string | null;
  expected_updated_at: string;
  expected_merchant: string;
  expected_category_id: string | null;
  expected_subcategory_id: string | null;
};

type AutomationPage = { from?: number; to?: number };

function comparePersistedOrder(left: MerchantAutomationRule, right: MerchantAutomationRule) {
  return left.position - right.position || (left.createdAt ?? "").localeCompare(right.createdAt ?? "") || left.id.localeCompare(right.id);
}

export function compileMerchantPattern(pattern: string) {
  return RE2JS.compile(pattern.trim(), RE2JS.CASE_INSENSITIVE);
}

export function evaluateMerchantAutomations(input: AutomationInput, rules: MerchantAutomationRule[]): MerchantAutomationResult {
  const merchant = input.merchant.trim();
  const matching = rules
    .filter((rule) => rule.enabled && rule.pattern.trim())
    .slice()
    .sort(comparePersistedOrder)
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
    conflicts.push({
      action: "normalize_merchant",
      winnerId: normalization.id,
      shadowedRuleIds: normalizeRules.slice(1).map((rule) => rule.id),
    });
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

export function fingerprintAutomationPreview(changes: readonly AutomationPreviewChange[]) {
  return JSON.stringify(
    changes
      .map((change) => ({
        id: change.id,
        merchant: change.merchant,
        category_id: change.category_id,
        subcategory_id: change.subcategory_id,
        expected_updated_at: change.expected_updated_at,
        expected_merchant: change.expected_merchant,
        expected_category_id: change.expected_category_id,
        expected_subcategory_id: change.expected_subcategory_id,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function pageBounds({ from = 0, to = 999 }: AutomationPage) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from > 999) {
    throw new Error("Invalid automation page range.");
  }
  return { from, to };
}

function automationRuleFromRow(row: {
  id: string;
  action: string;
  pattern: string;
  replacement: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
}): MerchantAutomationRule {
  if (row.action !== "normalize_merchant" && row.action !== "assign_category") throw new Error("Unable to load automation rules.");
  return {
    id: row.id,
    action: row.action,
    pattern: row.pattern,
    replacement: row.replacement,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    enabled: row.enabled,
    position: row.position,
    createdAt: row.created_at,
  };
}

export async function getMerchantAutomationRulesPage(options: AutomationPage = {}) {
  const { from, to } = pageBounds(options);
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") throw new Error("Create or join a household before viewing automations.");

  const { data, count, error } = await household.supabase
    .from("automation_rules")
    .select("id, action, pattern, replacement, category_id, subcategory_id, enabled, position, created_at", { count: "exact" })
    .eq("household_id", household.householdId)
    .order("position")
    .order("created_at")
    .order("id")
    .range(from, to);

  if (error || count === null) throw new Error("Unable to load automation rules.");
  return { count, rules: (data ?? []).map(automationRuleFromRow) };
}
