import { RE2JS } from "re2js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
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

export type AutomationPreviewConflict = AutomationConflict & { transactionCount: number };

export type AutomationRuleSnapshot = {
  id: string;
  action: AutomationAction;
  pattern: string;
  replacement: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  enabled: boolean;
  position: number;
};

export type MerchantAutomationPreview = {
  changes: AutomationPreviewChange[];
  conflicts: AutomationPreviewConflict[];
  fingerprint: string;
  ruleSet: AutomationRuleSnapshot[];
};

export type AutomationDestination = {
  categoryId: string | null;
  subcategoryId: string | null;
  label: string;
  kind: TransactionKind;
  color: string;
  icon: string | null;
};

type PreviewTransaction = {
  id: string;
  merchant: string;
  kind: TransactionKind;
  categoryId: string | null;
  subcategoryId: string | null;
  updatedAt: string;
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

function snapshotAutomationRules(rules: readonly MerchantAutomationRule[]): AutomationRuleSnapshot[] {
  return rules
    .slice()
    .sort(comparePersistedOrder)
    .map((rule) => ({
      id: rule.id,
      action: rule.action,
      pattern: rule.pattern,
      replacement: rule.replacement ?? null,
      category_id: rule.categoryId ?? null,
      subcategory_id: rule.subcategoryId ?? null,
      enabled: rule.enabled,
      position: rule.position,
    }));
}

export function fingerprintAutomationPreview(changes: readonly AutomationPreviewChange[], ruleSet: readonly AutomationRuleSnapshot[]) {
  return JSON.stringify({
    changes: changes
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
    ruleSet: ruleSet.slice().sort((left, right) => left.position - right.position || left.id.localeCompare(right.id)),
  });
}

export function previewMerchantAutomations(
  transactions: readonly PreviewTransaction[],
  rules: MerchantAutomationRule[],
): MerchantAutomationPreview {
  const ruleSet = snapshotAutomationRules(rules);
  const conflicts = new Map<string, AutomationPreviewConflict>();
  const changes = transactions.flatMap((transaction) => {
    const result = evaluateMerchantAutomations(transaction, rules);
    for (const conflict of result.conflicts) {
      const key = `${conflict.action}:${conflict.winnerId}:${conflict.shadowedRuleIds.join(",")}`;
      const current = conflicts.get(key);
      conflicts.set(key, { ...conflict, transactionCount: (current?.transactionCount ?? 0) + 1 });
    }
    if (
      result.merchant === transaction.merchant &&
      result.categoryId === transaction.categoryId &&
      result.subcategoryId === transaction.subcategoryId
    ) {
      return [];
    }
    return [
      {
        id: transaction.id,
        merchant: result.merchant,
        category_id: result.categoryId,
        subcategory_id: result.subcategoryId,
        expected_updated_at: transaction.updatedAt,
        expected_merchant: transaction.merchant,
        expected_category_id: transaction.categoryId,
        expected_subcategory_id: transaction.subcategoryId,
      },
    ];
  });

  return { changes, conflicts: [...conflicts.values()], fingerprint: fingerprintAutomationPreview(changes, ruleSet), ruleSet };
}

function pageBounds({ from = 0, to = 999 }: AutomationPage) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from > 999) {
    throw new Error("Invalid automation page range.");
  }
  return { from, to };
}

async function readAllPreviewTransactions(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    count: number | null;
    data: Array<{
      id: string;
      merchant: string;
      kind: TransactionKind;
      category_id: string | null;
      subcategory_id: string | null;
      updated_at: string;
    }> | null;
    error: unknown;
  }>,
) {
  const firstPage = await loadPage(0, 999);
  if (firstPage.error || firstPage.count === null || (firstPage.count > 0 && !firstPage.data?.length)) {
    throw new Error("Unable to load automation preview.");
  }
  const rows = [...(firstPage.data ?? [])];
  while (rows.length < firstPage.count) {
    const page = await loadPage(rows.length, rows.length + 999);
    if (page.error || !page.data?.length) throw new Error("Unable to load automation preview.");
    rows.push(...page.data);
  }
  return rows.slice(0, firstPage.count);
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

export async function getMerchantAutomationRules(supabase: SupabaseClient<Database>, householdId: string) {
  const { data, error } = await supabase
    .from("automation_rules")
    .select("id, action, pattern, replacement, category_id, subcategory_id, enabled, position, created_at")
    .eq("household_id", householdId)
    .order("position")
    .order("created_at")
    .order("id");
  if (error) throw new Error("Unable to load automation rules.");

  const rules = (data ?? []).map(automationRuleFromRow);
  const subcategoryIds = rules.flatMap((rule) => (rule.subcategoryId ? [rule.subcategoryId] : []));
  const { data: subcategories, error: subcategoriesError } = subcategoryIds.length
    ? await supabase.from("subcategories").select("id, category_id").eq("household_id", householdId).in("id", subcategoryIds)
    : { data: [], error: null };
  if (subcategoriesError) throw new Error("Unable to load automation rules.");

  const subcategoryCategoryIds = new Map((subcategories ?? []).map((subcategory) => [subcategory.id, subcategory.category_id]));
  const categoryIds = [
    ...new Set([...rules.flatMap((rule) => (rule.categoryId ? [rule.categoryId] : [])), ...subcategoryCategoryIds.values()]),
  ];
  const { data: categories, error: categoriesError } = categoryIds.length
    ? await supabase.from("categories").select("id, kind").eq("household_id", householdId).in("id", categoryIds)
    : { data: [], error: null };
  if (categoriesError) throw new Error("Unable to load automation rules.");

  const categoryKinds = new Map((categories ?? []).map((category) => [category.id, category.kind]));
  return rules.map((rule) => ({
    ...rule,
    destinationKind: rule.categoryId
      ? categoryKinds.get(rule.categoryId)
      : categoryKinds.get(subcategoryCategoryIds.get(rule.subcategoryId ?? "") ?? ""),
  }));
}

export async function getMerchantAutomationRulesPage(options: AutomationPage = {}) {
  const { from, to } = pageBounds(options);
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") throw new Error("Create or join a household before viewing automations.");

  const [rulesResult, categoriesResult, subcategoriesResult, transactions] = await Promise.all([
    household.supabase
      .from("automation_rules")
      .select("id, action, pattern, replacement, category_id, subcategory_id, enabled, position, created_at", { count: "exact" })
      .eq("household_id", household.householdId)
      .order("position")
      .order("created_at")
      .order("id")
      .range(from, to),
    household.supabase
      .from("categories")
      .select("id, name, kind, color, icon, archived_at, system_key")
      .eq("household_id", household.householdId)
      .is("archived_at", null)
      .order("kind")
      .order("name"),
    household.supabase
      .from("subcategories")
      .select("id, category_id, name, color, icon, archived_at")
      .eq("household_id", household.householdId)
      .is("archived_at", null)
      .order("name"),
    readAllPreviewTransactions((pageFrom, pageTo) =>
      household.supabase
        .from("transactions")
        .select("id, merchant, kind, category_id, subcategory_id, updated_at", { count: "exact" })
        .eq("household_id", household.householdId)
        .order("id")
        .range(pageFrom, pageTo),
    ),
  ]);

  if (rulesResult.error || rulesResult.count === null || categoriesResult.error || subcategoriesResult.error) {
    throw new Error("Unable to load automation rules.");
  }

  const rules = (rulesResult.data ?? []).map(automationRuleFromRow);
  const categories = categoriesResult.data ?? [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const subcategoryDestinations: AutomationDestination[] = (subcategoriesResult.data ?? []).flatMap((subcategory) => {
    const category = categoriesById.get(subcategory.category_id);
    return category && category.system_key !== "bills"
      ? [
          {
            categoryId: null,
            subcategoryId: subcategory.id,
            label: `${category.kind === "income" ? "Income" : "Expense"} → ${category.name} → ${subcategory.name}`,
            kind: category.kind,
            color: subcategory.color,
            icon: subcategory.icon ?? category.icon,
          },
        ]
      : [];
  });
  const directDestinations: AutomationDestination[] = categories.flatMap((category) =>
    category.system_key === "other_income" || category.system_key === "other_expense"
      ? [
          {
            categoryId: category.id,
            subcategoryId: null,
            label: `${category.kind === "income" ? "Income" : "Expense"} → Other`,
            kind: category.kind,
            color: category.color,
            icon: category.icon,
          },
        ]
      : [],
  );
  const destinations = [...subcategoryDestinations, ...directDestinations];
  const destinationKinds = new Map(
    destinations.map((destination) => [
      destination.categoryId ? `category:${destination.categoryId}` : `subcategory:${destination.subcategoryId}`,
      destination.kind,
    ]),
  );
  const previewRules = rules.map((rule) => ({
    ...rule,
    destinationKind: rule.categoryId
      ? destinationKinds.get(`category:${rule.categoryId}`)
      : rule.subcategoryId
        ? destinationKinds.get(`subcategory:${rule.subcategoryId}`)
        : undefined,
  }));
  // ponytail: the management page handles one 1,000-rule slice; with more rules, suppress incomplete reorder/apply UI until pagination is approved.
  const preview =
    rulesResult.count === rules.length
      ? previewMerchantAutomations(
          transactions.map((transaction) => ({
            id: transaction.id,
            merchant: transaction.merchant,
            kind: transaction.kind,
            categoryId: transaction.category_id,
            subcategoryId: transaction.subcategory_id,
            updatedAt: transaction.updated_at,
          })),
          previewRules,
        )
      : { changes: [], conflicts: [], fingerprint: fingerprintAutomationPreview([], []), ruleSet: [] };

  return { count: rulesResult.count, rules, destinations, preview };
}
