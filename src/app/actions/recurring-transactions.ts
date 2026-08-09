"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentHousehold } from "@/lib/household";

type ScheduleClient = {
  from: (table: "recurring_transaction_schedules") => {
    update: (values: {
      enabled?: boolean;
      paused_reason?: string | null;
      amount?: number;
      merchant?: string;
      note?: string;
      cadence?: string;
      interval_count?: number;
    }) => {
      eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: unknown }> };
    };
    delete: () => { eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: unknown }> } };
  };
};

export async function pauseRecurringTransactionSchedule(scheduleId: string, enabled: boolean) {
  const household = await requireCurrentHousehold();
  const { error } = await (household.supabase as unknown as ScheduleClient)
    .from("recurring_transaction_schedules")
    .update({ enabled, paused_reason: enabled ? null : "Paused by a household member." })
    .eq("id", scheduleId)
    .eq("household_id", household.householdId);
  if (!error) revalidatePath("/transactions");
}

export async function deleteRecurringTransactionSchedule(scheduleId: string) {
  const household = await requireCurrentHousehold();
  const { error } = await (household.supabase as unknown as ScheduleClient)
    .from("recurring_transaction_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("household_id", household.householdId);
  if (!error) revalidatePath("/transactions");
}

export async function updateRecurringTransactionSchedule(scheduleId: string, input: FormData) {
  const amount = Number(input.get("amount"));
  const merchant = String(input.get("merchant") ?? "").trim();
  const note = String(input.get("note") ?? "").trim();
  const cadence = String(input.get("cadence"));
  const intervalCount = Number(input.get("intervalCount"));
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isInteger(intervalCount) ||
    intervalCount < 1 ||
    !["weekly", "monthly", "custom_weekly", "custom_monthly"].includes(cadence)
  )
    return;
  const household = await requireCurrentHousehold();
  const { error } = await (household.supabase as unknown as ScheduleClient)
    .from("recurring_transaction_schedules")
    .update({ amount, merchant, note, cadence, interval_count: intervalCount })
    .eq("id", scheduleId)
    .eq("household_id", household.householdId);
  if (!error) revalidatePath("/transactions");
}
