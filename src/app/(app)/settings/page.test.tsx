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
  profileSelect: vi.fn(),
  profileEq: vi.fn(),
  profileMaybeSingle: vi.fn(),
  colorSelect: vi.fn(),
  colorHouseholdEq: vi.fn(),
  colorUserEq: vi.fn(),
  colorMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("@/components/partner-access-control", () => ({
  PartnerAccessControl: ({ state }: { state: { status: string; email?: string } }) => <span data-partner-state={state.status}>{state.email ?? "No authorized email"}</span>,
}));
vi.mock("@/components/member-card-settings-control", () => ({
  MemberCardSettingsControl: ({ lastFour }: { lastFour: string | null }) => <span data-card-last-four={lastFour ?? "none"} />,
}));
vi.mock("@/components/member-color-settings-control", () => ({
  MemberColorSettingsControl: ({ members }: { members: Array<{ id: string; color: string }> }) => <span data-member-colors={members.map((member) => member.color).join(",")} />,
}));

const settingsModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "owner-id", householdId: "household-id", role: "owner",
  });
  mocks.from.mockImplementation((table: string) => table === "household_members"
    ? { select: mocks.memberSelect }
    : table === "member_cards"
      ? { select: mocks.cardSelect }
      : table === "profiles"
        ? { select: mocks.profileSelect }
        : { select: mocks.authorizationSelect });
  mocks.memberSelect.mockReturnValue({ eq: mocks.memberEq });
  mocks.memberEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.memberOrder.mockResolvedValue({ data: [{ user_id: "owner-id", role: "owner", color: "#dcece3" }], error: null });
  mocks.memberSelect.mockImplementation((columns: string) => columns === "user_id, role, color"
    ? { eq: mocks.colorHouseholdEq }
    : { eq: mocks.memberEq });
  mocks.colorHouseholdEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.authorizationSelect.mockReturnValue({ eq: mocks.authorizationEq });
  mocks.authorizationEq.mockReturnValue({ maybeSingle: mocks.authorizationMaybeSingle });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.cardSelect.mockReturnValue({ eq: mocks.cardHouseholdEq });
  mocks.cardHouseholdEq.mockReturnValue({ eq: mocks.cardUserEq });
  mocks.cardUserEq.mockReturnValue({ maybeSingle: mocks.cardMaybeSingle });
  mocks.cardMaybeSingle.mockResolvedValue({ data: { last_four: "4548" }, error: null });
  mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
  mocks.profileEq.mockReturnValue({ maybeSingle: mocks.profileMaybeSingle });
  mocks.profileMaybeSingle.mockResolvedValue({ data: { full_name: "Ada Lovelace" }, error: null });
});

it("renders Appearance, Household, and Account cards", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain("Appearance");
  expect(markup).toContain("Household");
  expect(markup).toContain("Account");
  expect(markup).toContain("Session");
  expect(markup).toContain("Name");
  expect(markup).toContain("Card ending");
  expect(markup).toContain("Ada Lovelace");
  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.profileEq).toHaveBeenCalledWith("id", "owner-id");
  expect(markup.indexOf("Partner access")).toBeLessThan(markup.indexOf("Session"));
  expect(markup.indexOf("Household")).toBeLessThan(markup.indexOf("Account"));
});

it("derives the empty owner state through the member request context", async () => {
  await settingsModule.default();

  expect(mocks.from).toHaveBeenCalledWith("household_members");
  expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.colorHouseholdEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.authorizationEq).toHaveBeenCalledWith("household_id", "household-id");
});

it("does not query partner authorization for a member", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "member-id", householdId: "household-id", role: "member",
  });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain("Managed by owner");
  expect(mocks.authorizationSelect).not.toHaveBeenCalled();
});
