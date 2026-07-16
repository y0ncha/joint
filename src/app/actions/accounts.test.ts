import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerSupabaseClient: vi.fn(), requireCurrentHousehold: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
const actions = await import("./accounts").catch(() => null);

function formData(values: Record<string, string>) { const input = new FormData(); Object.entries(values).forEach(([key, value]) => input.set(key, value)); return input; }

describe("createAccount", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
    mocks.requireCurrentHousehold.mockResolvedValue({ householdId: "household-id", userId: "member-id", role: "member" });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("uses the verified household instead of submitted household data", async () => {
    await expect(actions?.createAccount(formData({ householdId: "other", name: "Shared card", kind: "credit_card", openingBalance: "1000.00", openingBalanceDate: "2026-07-01", lastFourDigits: "1234", statementCloseDay: "10" }))).resolves.toEqual({ status: "success" });
    expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", name: "Shared card", kind: "credit_card", opening_balance: 1000, opening_balance_date: "2026-07-01", last_four_digits: "1234", statement_close_day: 10 });
  });

  it("scopes account updates to the verified household", async () => {
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: mocks.eq }) });
    mocks.from.mockReturnValue({ update: mocks.update });

    await expect(actions?.updateAccount("account-id", formData({ name: "Renamed", kind: "bank", openingBalance: "0", openingBalanceDate: "2026-07-01" }))).resolves.toEqual({ status: "success" });

    expect(mocks.eq).toHaveBeenCalledWith("household_id", "household-id");
  });
});
