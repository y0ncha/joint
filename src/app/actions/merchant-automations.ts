"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import {
  compileMerchantPattern,
  fingerprintAutomationPreview,
  type AutomationPreviewChange,
  type AutomationRuleSnapshot,
} from "@/lib/merchant-automations";

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

const automationRuleSchema = z
  .object({
    action: z.enum(["normalize_merchant", "assign_category"]),
    pattern: z.string().trim().min(1, "Enter a merchant pattern.").max(200, "Use 200 characters or fewer."),
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
    } else {
      if (value.replacement !== null) context.addIssue({ code: "custom", path: ["replacement"], message: "Leave the replacement empty." });
      if ((value.categoryId === null ? 0 : 1) + (value.subcategoryId === null ? 0 : 1) !== 1) {
        context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose one destination." });
      }
    }
  });

const previewChangeSchema: z.ZodType<AutomationPreviewChange> = z.object({
  id: z.string().uuid(),
  merchant: z.string().max(200),
  category_id: z.string().uuid().nullable(),
  subcategory_id: z.string().uuid().nullable(),
  expected_updated_at: z.string().min(1),
  expected_merchant: z.string().max(200),
  expected_category_id: z.string().uuid().nullable(),
  expected_subcategory_id: z.string().uuid().nullable(),
});
const previewChangesSchema = z.array(previewChangeSchema);
const ruleSetSchema: z.ZodType<AutomationRuleSnapshot[]> = z.array(
  z.object({
    id: z.string().uuid(),
    action: z.enum(["normalize_merchant", "assign_category"]),
    pattern: z.string().min(1).max(200),
    replacement: z.string().max(200).nullable(),
    category_id: z.string().uuid().nullable(),
    subcategory_id: z.string().uuid().nullable(),
    enabled: z.boolean(),
    position: z.number().int().nonnegative(),
  }),
);
const enabledRuleSchema = z.object({ ruleId: z.string().uuid(), enabled: z.boolean() });

const GENERIC_ERROR = "Unable to save the automation rule. Please try again.";

function parseRule(input: FormData) {
  const parsed = automationRuleSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return { error: validationError(parsed.error.issues) as ActionResult };
  try {
    compileMerchantPattern(parsed.data.pattern);
  } catch {
    return {
      error: {
        status: "error",
        formError: "Check the form details.",
        fieldErrors: { pattern: "Enter a valid RE2 pattern." },
      } as ActionResult,
    };
  }
  return { data: parsed.data };
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

export async function applyAutomationResults(
  changes: AutomationPreviewChange[],
  ruleSet: AutomationRuleSnapshot[],
  fingerprint: string,
): Promise<ActionResult> {
  const parsedChanges = previewChangesSchema.safeParse(changes);
  if (!parsedChanges.success) return validationError(parsedChanges.error.issues);
  const parsedRuleSet = ruleSetSchema.safeParse(ruleSet);
  if (!parsedRuleSet.success) return validationError(parsedRuleSet.error.issues);
  if (fingerprintAutomationPreview(parsedChanges.data, parsedRuleSet.data) !== fingerprint) {
    return {
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    };
  }

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("apply_automation_results", {
    target_household_id: household.householdId,
    changes: parsedChanges.data,
    expected_rule_set: parsedRuleSet.data,
  });
  if (error?.message?.includes("Automation preview is stale")) {
    return {
      status: "error",
      formError: "This automation preview is stale. Refresh it before applying changes.",
      fieldErrors: {},
    };
  }
  if (error) return { status: "error", formError: "Unable to apply automation changes. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidateAutomations();
  return { status: "success" };
}
