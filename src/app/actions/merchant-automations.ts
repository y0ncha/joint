"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { compatibilityPattern, parseAutomationConditionGroup, type AutomationConditionGroup } from "@/lib/automation-conditions";
import { requireCurrentHousehold } from "@/lib/household";
import { compileMerchantPattern, getMerchantAutomationRulesPage } from "@/lib/merchant-automations";
import { encodeMerchantPattern, type MerchantMatchMode } from "@/lib/merchant-pattern";

const nullableId = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.string().uuid("Choose a valid destination.").nullable(),
);
const nullableText = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.string().trim().min(1).max(200).nullable(),
);
const enabled = z.preprocess(
  (value) => (value === "true" || value === "on" ? true : value === "false" || value === "off" ? false : value),
  z.boolean().default(true),
);
const merchantMatchModes = ["contains", "equals", "starts_with", "ends_with", "advanced"] as const satisfies readonly MerchantMatchMode[];

const automationRuleSchema = z
  .object({
    action: z.enum(["normalize_merchant", "assign_category", "delete_transaction"]),
    matchMode: z.enum(merchantMatchModes, { error: "Choose a valid merchant match mode." }),
    matchValue: z.string().trim().min(1, "Enter a merchant pattern."),
    replacement: nullableText,
    categoryId: nullableId,
    subcategoryId: nullableId,
    enabled,
  })
  .superRefine((value, context) => {
    if (value.action === "normalize_merchant") {
      if (value.replacement === null) context.addIssue({ code: "custom", path: ["replacement"], message: "Enter a replacement." });
      if (value.categoryId !== null) context.addIssue({ code: "custom", path: ["categoryId"], message: "Leave the category empty." });
      if (value.subcategoryId !== null)
        context.addIssue({ code: "custom", path: ["subcategoryId"], message: "Leave the subcategory empty." });
    } else if (value.action === "assign_category") {
      if (value.replacement !== null) context.addIssue({ code: "custom", path: ["replacement"], message: "Leave the replacement empty." });
      if ((value.categoryId === null ? 0 : 1) + (value.subcategoryId === null ? 0 : 1) !== 1) {
        context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose one destination." });
      }
    } else {
      if (value.replacement !== null) context.addIssue({ code: "custom", path: ["replacement"], message: "Leave the replacement empty." });
      if (value.categoryId !== null) context.addIssue({ code: "custom", path: ["categoryId"], message: "Leave the category empty." });
      if (value.subcategoryId !== null)
        context.addIssue({ code: "custom", path: ["subcategoryId"], message: "Leave the subcategory empty." });
    }
  });

const enabledRuleSchema = z.object({ ruleId: z.string().uuid(), enabled: z.boolean() });

const GENERIC_ERROR = "Unable to save the automation rule. Please try again.";

function parseRule(input: FormData) {
  const raw = Object.fromEntries(input);
  const conditionValue = raw.conditions;
  let submittedConditions: AutomationConditionGroup | undefined;
  if (typeof conditionValue === "string" && conditionValue.trim()) {
    try {
      const decoded: unknown = JSON.parse(conditionValue);
      const conditionResult = parseAutomationConditionGroup(decoded);
      if (!conditionResult.success) {
        const regexIssue = conditionResult.issues.find((issue) => issue.message === "Enter a valid RE2 pattern.");
        if (regexIssue) {
          return { error: validationError([{ path: ["pattern"], message: regexIssue.message }]) as ActionResult };
        }
        return { error: validationError([{ path: ["conditions"], message: "Check each condition." }]) as ActionResult };
      }
      submittedConditions = conditionResult.data;
    } catch {
      return { error: validationError([{ path: ["conditions"], message: "Check each condition." }]) as ActionResult };
    }
  }

  const parsed = automationRuleSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path[0] === "matchValue" ? ["pattern"] : issue.path,
      message: issue.message,
    }));
    return { error: validationError(issues) as ActionResult };
  }
  const conditions =
    submittedConditions ??
    ({
      logic: "and",
      conditions: [{ field: "merchant", operator: parsed.data.matchMode, value: parsed.data.matchValue }],
    } as AutomationConditionGroup);
  const pattern = submittedConditions
    ? compatibilityPattern(conditions)
    : encodeMerchantPattern(parsed.data.matchMode, parsed.data.matchValue);
  if (pattern.length > 200) {
    return {
      error: {
        status: "error",
        formError: "Check the form details.",
        fieldErrors: { pattern: "Use 200 characters or fewer." },
      } as ActionResult,
    };
  }
  try {
    if (!submittedConditions) compileMerchantPattern(pattern);
  } catch {
    return {
      error: {
        status: "error",
        formError: "Check the form details.",
        fieldErrors: { pattern: "Enter a valid RE2 pattern." },
      } as ActionResult,
    };
  }
  return {
    data: {
      ...parsed.data,
      pattern,
      conditions: submittedConditions ? conditions : undefined,
    },
  };
}

function revalidateAutomations() {
  revalidatePath("/automations");
}

export async function createAutomationRule(input: FormData): Promise<ActionResult> {
  const parsed = parseRule(input);
  if (parsed.error) return parsed.error;

  const household = await requireCurrentHousehold();
  const { data: lastRule, error: lastRuleError } = await household.supabase
    .from("automation_rules")
    .select("position")
    .eq("household_id", household.householdId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRuleError) return { status: "error", formError: GENERIC_ERROR, fieldErrors: {} };

  const { data } = parsed;
  // ponytail: max+1 append is enough for the management UI; add an insert-position RPC if concurrent creates need retry-safe allocation.
  const { error } = await household.supabase.from("automation_rules").insert({
    household_id: household.householdId,
    action: data.action,
    pattern: data.pattern,
    ...(data.conditions ? { conditions: data.conditions } : {}),
    replacement: data.replacement,
    category_id: data.categoryId,
    subcategory_id: data.subcategoryId,
    enabled: data.enabled,
    position: (lastRule?.position ?? -1) + 1,
  });
  if (error) return { status: "error", formError: GENERIC_ERROR, fieldErrors: {} };
  revalidateAutomations();
  return { status: "success" };
}

export async function updateAutomationRule(ruleId: string, input: FormData): Promise<ActionResult> {
  const parsed = parseRule(input);
  if (parsed.error) return parsed.error;
  const household = await requireCurrentHousehold();
  const { data } = parsed;
  const { error } = await household.supabase
    .from("automation_rules")
    .update({
      action: data.action,
      pattern: data.pattern,
      ...(data.conditions ? { conditions: data.conditions } : {}),
      replacement: data.replacement,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId,
      enabled: data.enabled,
    })
    .eq("id", ruleId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: GENERIC_ERROR, fieldErrors: {} };
  revalidateAutomations();
  return { status: "success" };
}

export async function setAutomationRuleEnabled(ruleId: string, value: boolean): Promise<ActionResult> {
  const parsed = enabledRuleSchema.safeParse({ ruleId, enabled: value });
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("automation_rules")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.ruleId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: GENERIC_ERROR, fieldErrors: {} };
  revalidateAutomations();
  return { status: "success", data: { enabled: String(parsed.data.enabled) } };
}

export async function deleteAutomationRule(ruleId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("automation_rules").delete().eq("id", ruleId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the automation rule. Please try again.", fieldErrors: {} };
  revalidateAutomations();
  return { status: "success" };
}

export async function reorderAutomationRules(orderedRuleIds: string[]): Promise<ActionResult> {
  const parsed = z.array(z.string().uuid()).safeParse(orderedRuleIds);
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("reorder_automation_rules", {
    target_household_id: household.householdId,
    ordered_rule_ids: parsed.data,
  });
  if (error) return { status: "error", formError: "Unable to reorder automation rules. Please try again.", fieldErrors: {} };
  revalidateAutomations();
  return { status: "success" };
}

function staleAutomationPreview(): ActionResult {
  return {
    status: "error",
    formError: "This automation preview is stale. Refresh it before applying changes.",
    fieldErrors: {},
  };
}

async function applyAutomationPreview(fingerprint: string, changeId?: string): Promise<ActionResult> {
  let preview;
  try {
    ({ preview } = await getMerchantAutomationRulesPage());
  } catch {
    return { status: "error", formError: "Unable to apply automation changes. Please try again.", fieldErrors: {} };
  }
  const changes = changeId ? preview.changes.filter((change) => change.id === changeId) : preview.changes;
  if (!changes.length || preview.fingerprint !== fingerprint) return staleAutomationPreview();

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("apply_automation_results", {
    target_household_id: household.householdId,
    changes,
    expected_rule_set: preview.ruleSet,
  });
  if (error?.message?.includes("Automation preview is stale")) return staleAutomationPreview();
  if (error) return { status: "error", formError: "Unable to apply automation changes. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidateAutomations();
  return { status: "success" };
}

export async function applyAutomationResults(fingerprint: string): Promise<ActionResult> {
  return applyAutomationPreview(fingerprint);
}

export async function applyAutomationResult(fingerprint: string, changeId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(changeId).success) return staleAutomationPreview();
  return applyAutomationPreview(fingerprint, changeId);
}
