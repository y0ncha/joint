import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const actions = await import("./recurring-transactions");

describe("recurring schedule lifecycle actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId: "household-id", supabase: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it.each([
    ["pauseRecurringTransactionSchedule", "paused"],
    ["resumeRecurringTransactionSchedule", "active"],
    ["stopRecurringTransactionSchedule", "stopped"],
  ] as const)("maps %s to the %s status RPC", async (actionName, status) => {
    await expect(actions[actionName]("schedule-id")).resolves.toEqual({ status: "success" });

    expect(mocks.requireCurrentHousehold).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("set_recurring_transaction_schedule_status", {
      target_schedule_id: "schedule-id",
      target_status: status,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  it("does not pass browser-controlled ownership or reason fields", async () => {
    await actions.pauseRecurringTransactionSchedule("schedule-id");

    expect(mocks.rpc.mock.calls[0]?.[1]).toEqual({ target_schedule_id: "schedule-id", target_status: "paused" });
  });

  it.each(["pauseRecurringTransactionSchedule", "resumeRecurringTransactionSchedule", "stopRecurringTransactionSchedule"] as const)(
    "sanitizes %s RPC failures and skips revalidation",
    async (actionName) => {
      mocks.rpc.mockResolvedValue({ error: new Error("database secret") });

      await expect(actions[actionName]("schedule-id")).resolves.toEqual({
        status: "error",
        formError: "Unable to save the recurring schedule. Please try again.",
        fieldErrors: {},
      });

      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("exposes only the explicit lifecycle adapters", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "pauseRecurringTransactionSchedule",
      "resumeRecurringTransactionSchedule",
      "stopRecurringTransactionSchedule",
    ]);
  });
});
