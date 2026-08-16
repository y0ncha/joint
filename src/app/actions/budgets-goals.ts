"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { budgetInputSchema, goalInputSchema, targetIdSchema, targetKindSchema } from "@/lib/budgets-goals";

const budgetTargetSchema = z.object({ targetKind: targetKindSchema, targetId: targetIdSchema });
const goalIdSchema = z.string().uuid("Choose a valid goal.");

const SAVE_BUDGET_ERROR = "Unable to save the budget. Please try again.";
const REMOVE_BUDGET_ERROR = "Unable to remove the budget. Please try again.";
const SAVE_GOAL_ERROR = "Unable to save the goal. Please try again.";
const UPDATE_GOAL_ERROR = "Unable to update the goal. Please try again.";
const DELETE_GOAL_ERROR = "Unable to delete the goal. Please try again.";
const INVALID_TARGET_ERROR = "Choose an active expense target.";
const INVALID_DATE_ERROR = "Choose today or a future date.";

type Household = Awaited<ReturnType<typeof requireCurrentHousehold>>;

function formError(formError: string, fieldErrors: Record<string, string> = {}): ActionResult {
  return { status: "error", formError, fieldErrors };
}

function todayUtcIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseBudgetTarget(input: FormData) {
  return budgetTargetSchema.safeParse({
    targetKind: input.get("targetKind"),
    targetId: input.get("targetId"),
  });
}

function parseGoalId(goalId: string) {
  const parsed = goalIdSchema.safeParse(goalId);
  return parsed.success ? parsed.data : null;
}

function hasExpectedRow(data: unknown, id: string) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.some((row) => row !== null && typeof row === "object" && "id" in row && row.id === id);
}

function hasPersistedRow(data: unknown) {
  const rows = Array.isArray(data) ? data : [data];
  return rows.some((row) => row !== null && typeof row === "object" && typeof row.id === "string");
}

function belongsToHousehold(row: unknown, householdId: string) {
  return row !== null && typeof row === "object" && (!("household_id" in row) || row.household_id === householdId);
}

async function isActiveExpenseTarget(household: Household, targetKind: "category" | "subcategory", targetId: string) {
  if (targetKind === "category") {
    const { data, error } = await household.supabase
      .from("categories")
      .select("id, household_id, kind, archived_at")
      .eq("id", targetId)
      .eq("household_id", household.householdId)
      .maybeSingle();
    return Boolean(
      !error && data && belongsToHousehold(data, household.householdId) && data.archived_at === null && data.kind === "expense",
    );
  }

  const { data, error } = await household.supabase
    .from("subcategories")
    .select("id, household_id, category_id, archived_at")
    .eq("id", targetId)
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (error || !data || !belongsToHousehold(data, household.householdId) || data.archived_at !== null) return false;

  const { data: parent, error: parentError } = await household.supabase
    .from("categories")
    .select("id, household_id, kind, archived_at")
    .eq("id", data.category_id)
    .eq("household_id", household.householdId)
    .maybeSingle();

  return Boolean(
    !parentError && parent && belongsToHousehold(parent, household.householdId) && parent.archived_at === null && parent.kind === "expense",
  );
}

async function updateBudget(household: Household, targetKind: "category" | "subcategory", targetId: string, monthlyBudget: number | null) {
  const { data, error } = await household.supabase
    .from(targetKind === "category" ? "categories" : "subcategories")
    .update({ monthly_budget: monthlyBudget })
    .eq("id", targetId)
    .eq("household_id", household.householdId)
    .select("id")
    .maybeSingle();

  return !error && hasExpectedRow(data, targetId);
}

function revalidateBudgetRoutes() {
  revalidatePath("/budgets-goals");
  revalidatePath("/");
  revalidatePath("/analytics");
}

function revalidateGoalRoutes() {
  revalidatePath("/budgets-goals");
  revalidatePath("/");
}

export async function saveMonthlyBudget(_previousState: ActionResult | null, input: FormData): Promise<ActionResult> {
  const parsed = budgetInputSchema.safeParse({
    targetKind: input.get("targetKind"),
    targetId: input.get("targetId"),
    monthlyBudget: input.get("monthlyBudget"),
  });
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  if (
    !(await isActiveExpenseTarget(household, parsed.data.targetKind, parsed.data.targetId)) ||
    !(await updateBudget(household, parsed.data.targetKind, parsed.data.targetId, parsed.data.monthlyBudget))
  ) {
    return formError(SAVE_BUDGET_ERROR, { targetId: INVALID_TARGET_ERROR });
  }

  revalidateBudgetRoutes();
  return { status: "success" };
}

export async function removeMonthlyBudget(_previousState: ActionResult | null, input: FormData): Promise<ActionResult> {
  const parsed = parseBudgetTarget(input);
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  if (
    !(await isActiveExpenseTarget(household, parsed.data.targetKind, parsed.data.targetId)) ||
    !(await updateBudget(household, parsed.data.targetKind, parsed.data.targetId, null))
  ) {
    return formError(REMOVE_BUDGET_ERROR, { targetId: INVALID_TARGET_ERROR });
  }

  revalidateBudgetRoutes();
  return { status: "success" };
}

function parseGoalInput(input: FormData) {
  return goalInputSchema.safeParse({
    name: input.get("name"),
    targetAmount: input.get("targetAmount"),
    savedAmount: input.get("savedAmount"),
    targetDate: input.get("targetDate"),
  });
}

function validateGoalDate(targetDate: string): ActionResult | null {
  return targetDate < todayUtcIso() ? formError("Check the form details.", { targetDate: INVALID_DATE_ERROR }) : null;
}

export async function createSavingsGoal(_previousState: ActionResult | null, input: FormData): Promise<ActionResult> {
  const parsed = parseGoalInput(input);
  if (!parsed.success) return validationError(parsed.error.issues);
  const dateError = validateGoalDate(parsed.data.targetDate);
  if (dateError) return dateError;

  const household = await requireCurrentHousehold();
  const { data, error } = await household.supabase
    .from("savings_goals")
    .insert({
      household_id: household.householdId,
      name: parsed.data.name,
      target_amount: parsed.data.targetAmount,
      saved_amount: parsed.data.savedAmount,
      target_date: parsed.data.targetDate,
    })
    .select("id")
    .maybeSingle();
  if (error || !hasPersistedRow(data)) {
    return formError(SAVE_GOAL_ERROR);
  }

  revalidateGoalRoutes();
  return { status: "success" };
}

export async function updateSavingsGoal(goalId: string, _previousState: ActionResult | null, input: FormData): Promise<ActionResult> {
  const parsedGoalId = parseGoalId(goalId);
  if (!parsedGoalId) return validationError([{ path: ["goalId"], message: "Choose a valid goal." }]);

  const parsed = parseGoalInput(input);
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  if (parsed.data.targetDate < todayUtcIso()) {
    const { data, error } = await household.supabase
      .from("savings_goals")
      .select("id, target_date")
      .eq("id", parsedGoalId)
      .eq("household_id", household.householdId)
      .maybeSingle();
    if (error || !data || !hasExpectedRow(data, parsedGoalId)) return formError(UPDATE_GOAL_ERROR);
    if (data.target_date !== parsed.data.targetDate) {
      return formError("Check the form details.", { targetDate: INVALID_DATE_ERROR });
    }
  }

  const { data, error } = await household.supabase
    .from("savings_goals")
    .update({
      name: parsed.data.name,
      target_amount: parsed.data.targetAmount,
      saved_amount: parsed.data.savedAmount,
      target_date: parsed.data.targetDate,
    })
    .eq("id", parsedGoalId)
    .eq("household_id", household.householdId)
    .select("id")
    .maybeSingle();
  if (error || !hasExpectedRow(data, parsedGoalId)) return formError(UPDATE_GOAL_ERROR);

  revalidateGoalRoutes();
  return { status: "success" };
}

export async function deleteSavingsGoal(goalId: string, _previousState: ActionResult | null, _input: FormData): Promise<ActionResult> {
  void _previousState;
  void _input;
  const parsedGoalId = parseGoalId(goalId);
  if (!parsedGoalId) return validationError([{ path: ["goalId"], message: "Choose a valid goal." }]);

  const household = await requireCurrentHousehold();
  const { data, error } = await household.supabase
    .from("savings_goals")
    .delete()
    .eq("id", parsedGoalId)
    .eq("household_id", household.householdId)
    .select("id")
    .maybeSingle();
  if (error || !hasExpectedRow(data, parsedGoalId)) return formError(DELETE_GOAL_ERROR);

  revalidateGoalRoutes();
  return { status: "success" };
}
