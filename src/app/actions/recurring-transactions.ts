"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { recurringScheduleSchema } from "@/lib/validation";

const SAVE_ERROR = "Unable to save the recurring schedule. Please try again.";

export async function pauseRecurringTransactionSchedule(scheduleId: string, enabled: boolean): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("set_recurring_transaction_schedule_enabled", {
    target_enabled: enabled,
    target_schedule_id: scheduleId,
  });
  if (error) return { status: "error", formError: SAVE_ERROR, fieldErrors: {} };
  revalidatePath("/transactions");
  return { status: "success" };
}

export async function deleteRecurringTransactionSchedule(scheduleId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("delete_recurring_transaction_schedule", { target_schedule_id: scheduleId });
  if (error) return { status: "error", formError: "Unable to delete the recurring schedule. Please try again.", fieldErrors: {} };
  revalidatePath("/transactions");
  return { status: "success" };
}

export async function updateRecurringTransactionSchedule(scheduleId: string, input: FormData): Promise<ActionResult> {
  const parsed = recurringScheduleSchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("update_recurring_transaction_schedule", {
    target_amount: parsed.data.amount,
    target_cadence: parsed.data.cadence,
    target_interval_count: parsed.data.intervalCount,
    target_merchant: parsed.data.merchant,
    target_note: parsed.data.note,
    target_schedule_id: scheduleId,
  });
  if (error) return { status: "error", formError: SAVE_ERROR, fieldErrors: {} };
  revalidatePath("/transactions");
  return { status: "success" };
}
