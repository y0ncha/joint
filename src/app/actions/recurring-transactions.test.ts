import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./recurring-transactions");

function scheduleForm(values: Record<string, string> = {}) {
  const form = new FormData();
  form.set("amount", "42.5");
  form.set("merchant", "Electricity");
  form.set("note", "Monthly bill");
  form.set("cadence", "custom_monthly");
  form.set("intervalCount", "3");
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("recurring schedule actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId: "household-id", supabase: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("updates a custom-monthly schedule through its constrained RPC", async () => {
    await expect(actions.updateRecurringTransactionSchedule("schedule-id", scheduleForm())).resolves.toEqual({ status: "success" });

    expect(mocks.rpc).toHaveBeenCalledWith("update_recurring_transaction_schedule", {
      target_amount: 42.5,
      target_cadence: "custom_monthly",
      target_interval_count: 3,
      target_merchant: "Electricity",
      target_note: "Monthly bill",
      target_schedule_id: "schedule-id",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("returns an error when a schedule update is rejected", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("rejected") });

    await expect(actions.updateRecurringTransactionSchedule("schedule-id", scheduleForm())).resolves.toMatchObject({
      status: "error",
      formError: expect.stringContaining("Unable to save"),
    });
  });

  it("rejects an invalid recurrence interval before calling the database", async () => {
    await expect(actions.updateRecurringTransactionSchedule("schedule-id", scheduleForm({ intervalCount: "0" }))).resolves.toMatchObject({
      status: "error",
      fieldErrors: { intervalCount: expect.any(String) },
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
