import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHousehold: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  from: vi.fn(),
  memberSelect: vi.fn(),
  memberEq: vi.fn(),
  memberOrder: vi.fn(),
  authorizationSelect: vi.fn(),
  authorizationEq: vi.fn(),
  authorizationMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("@/components/partner-access-control", () => ({
  PartnerAccessControl: ({ state }: { state: { status: string; email?: string } }) => (
    <span data-partner-state={state.status}>{state.email ?? "No authorized email"}</span>
  ),
}));

const settingsModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });
  mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
  mocks.from.mockImplementation((table: string) => table === "household_members"
    ? { select: mocks.memberSelect }
    : { select: mocks.authorizationSelect });
  mocks.memberSelect.mockReturnValue({ eq: mocks.memberEq });
  mocks.memberEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.memberOrder.mockResolvedValue({ data: [{ role: "owner" }], error: null });
  mocks.authorizationSelect.mockReturnValue({ eq: mocks.authorizationEq });
  mocks.authorizationEq.mockReturnValue({ maybeSingle: mocks.authorizationMaybeSingle });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: null });
});

it("renders only Appearance and Account cards without notification controls", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect((markup.match(/data-slot="card"/g) ?? []).length).toBe(2);
  expect(markup).toContain("Appearance");
  expect(markup).toContain("Account");
  expect(markup).toContain("Session");
  expect(markup).not.toContain("Notifications");
  expect(markup).not.toContain("Monthly summary");
  expect(markup).not.toContain("Reminder cadence");
  expect(markup).not.toContain("data-slot=\"select-trigger\"");
  expect(markup).toContain('data-partner-state="empty"');
  expect(markup).not.toContain("profiles");
});

it("derives the empty owner state without looking up identities", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain('data-partner-state="empty"');
  expect(mocks.from).toHaveBeenCalledWith("household_members");
  expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
  expect(mocks.from).not.toHaveBeenCalledWith("profiles");
});

it.each([
  [[{ role: "owner" }], "pending"],
  [[{ role: "owner" }, { role: "member" }], "joined"],
] as const)("passes the owner partner lifecycle state to the control", async (members, status) => {
  mocks.memberOrder.mockResolvedValue({ data: members, error: null });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: { email: "partner@example.com" }, error: null });

  const source = renderToStaticMarkup(await settingsModule.default());

  expect(source).toContain(`data-partner-state="${status}"`);
  expect(source).toContain("partner@example.com");
  expect(mocks.authorizationSelect).toHaveBeenCalledWith("email");
});

it("does not query partner authorization for a member", async () => {
  mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "member" });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain("Managed by owner");
  expect(mocks.authorizationSelect).not.toHaveBeenCalled();
});
