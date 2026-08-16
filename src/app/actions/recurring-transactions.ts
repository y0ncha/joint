"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";

const SAVE_ERROR = "Unable to save the recurring schedule. Please try again.";

async function setRecurringTransactionScheduleStatus(scheduleId: string, status: "paused" | "active" | "stopped"): Promise<ActionResult> {
  const household = await requireCurrentHousehold();

  const { error } = await household.supabase.rpc("set_recurring_transaction_schedule_status", {
    target_schedule_id: scheduleId,
    target_status: status,
  });

  if (error) return { status: "error", formError: SAVE_ERROR, fieldErrors: {} };
  revalidatePath("/transactions");
  return { status: "success" };
}

export async function pauseRecurringTransactionSchedule(scheduleId: string): Promise<ActionResult> {
  return setRecurringTransactionScheduleStatus(scheduleId, "paused");
}

export async function resumeRecurringTransactionSchedule(scheduleId: string): Promise<ActionResult> {
  return setRecurringTransactionScheduleStatus(scheduleId, "active");
}

export async function stopRecurringTransactionSchedule(scheduleId: string): Promise<ActionResult> {
  return setRecurringTransactionScheduleStatus(scheduleId, "stopped");
}
