import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  from: vi.fn(),
  memberSelect: vi.fn(),
  memberEq: vi.fn(),
  memberOrder: vi.fn(),
  authorizationSelect: vi.fn(),
  authorizationEq: vi.fn(),
  authorizationMaybeSingle: vi.fn(),
  cardSelect: vi.fn(),
  cardHouseholdEq: vi.fn(),
  cardUserEq: vi.fn(),
  cardMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("@/components/partner-access-control", () => ({
  PartnerAccessControl: ({ state }: { state: { status: string; email?: string } }) => <span data-partner-state={state.status}>{state.email ?? "No authorized email"}</span>,
}));
vi.mock("@/components/member-card-settings-control", () => ({
  MemberCardSettingsControl: ({ lastFour }: { lastFour: string | null }) => <span data-card-last-four={lastFour ?? "none"} />,
}));

const settingsModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "owner-id", householdId: "household-id", role: "owner",
  });
  mocks.from.mockImplementation((table: string) => table === "household_members"
    ? { select: mocks.memberSelect }
    : table === "member_card_mappings"
      ? { select: mocks.cardSelect }
    : { select: mocks.authorizationSelect });
  mocks.memberSelect.mockReturnValue({ eq: mocks.memberEq });
  mocks.memberEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.memberOrder.mockResolvedValue({ data: [{ role: "owner" }], error: null });
  mocks.authorizationSelect.mockReturnValue({ eq: mocks.authorizationEq });
  mocks.authorizationEq.mockReturnValue({ maybeSingle: mocks.authorizationMaybeSingle });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.cardSelect.mockReturnValue({ eq: mocks.cardHouseholdEq });
  mocks.cardHouseholdEq.mockReturnValue({ eq: mocks.cardUserEq });
  mocks.cardUserEq.mockReturnValue({ maybeSingle: mocks.cardMaybeSingle });
  mocks.cardMaybeSingle.mockResolvedValue({ data: { last_four: "4548" }, error: null });
});

it("renders Appearance and Account cards", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect((markup.match(/data-slot="card"/g) ?? []).length).toBe(2);
  expect(markup).toContain("Appearance");
  expect(markup).toContain("Account");
  expect(markup).toContain("Session");
  expect(markup).toContain("Card ending");
  expect(markup).not.toContain("Card last four");
  expect(markup).toContain('data-card-last-four="4548"');
  expect(markup).toContain('data-partner-state="empty"');
  expect(markup).not.toContain("profiles");
});

it("derives the empty owner state through the member request context", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain('data-partner-state="empty"');
  expect(mocks.from).toHaveBeenCalledWith("household_members");
  expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
  expect(mocks.from).not.toHaveBeenCalledWith("profiles");
  expect(mocks.memberEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.authorizationEq).toHaveBeenCalledWith("household_id", "household-id");
});

it.each([
  [[{ role: "owner" }], "pending"],
  [[{ role: "owner" }, { role: "member" }], "joined"],
] as const)("passes the owner partner lifecycle state to the control", async (members, status) => {
  mocks.memberOrder.mockResolvedValue({ data: members, error: null });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: { email: "partner@example.com" }, error: null });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain(`data-partner-state="${status}"`);
  expect(markup).toContain("partner@example.com");
  expect(mocks.authorizationSelect).toHaveBeenCalledWith("email");
});

it("does not query partner authorization for a member", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "member-id", householdId: "household-id", role: "member",
  });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain("Managed by owner");
  expect(mocks.authorizationSelect).not.toHaveBeenCalled();
});
