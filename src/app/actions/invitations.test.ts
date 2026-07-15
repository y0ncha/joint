import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerSupabaseClient: vi.fn(), requireCurrentHousehold: vi.fn(), from: vi.fn(), insert: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
const actions = await import("./invitations").catch(() => null);

it("creates an owner-scoped invitation link", async () => {
  mocks.requireCurrentHousehold.mockResolvedValue({ householdId: "household-id", userId: "owner-id", role: "owner" });
  mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { token: "invite-token" }, error: null }) }) });
  mocks.headers.mockResolvedValue(new Headers({ origin: "http://127.0.0.1:3000" }));
  const input = new FormData(); input.set("email", "Partner@Example.com");
  await expect(actions?.createInvitation(input)).resolves.toEqual({ status: "success", data: { invitationUrl: "http://127.0.0.1:3000/invite/invite-token" } });
  expect(mocks.insert).toHaveBeenCalledWith({ household_id: "household-id", invited_by: "owner-id", email: "partner@example.com" });
});
