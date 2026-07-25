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
  cardList: vi.fn(),
  profileSelect: vi.fn(),
  profileEq: vi.fn(),
  profileMaybeSingle: vi.fn(),
  partnerProfileEq: vi.fn(),
  partnerProfileMaybeSingle: vi.fn(),
  householdSelect: vi.fn(),
  householdEq: vi.fn(),
  householdMaybeSingle: vi.fn(),
  colorSelect: vi.fn(),
  colorHouseholdEq: vi.fn(),
  colorUserEq: vi.fn(),
  colorMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/partner-access-control", () => ({
  MemberManagementSheet: ({ partner }: { partner: { status: string; email?: string } }) => <button type="button" aria-label="Manage members" data-partner-state={partner.status}>{partner.email ?? "No authorized email"}</button>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/member-card-settings-control", () => ({
  MemberCardSettingsControl: ({ lastFour }: { lastFour: string | null }) => <span data-card-last-four={lastFour ?? "none"} />,
}));
vi.mock("@/components/member-color-settings-control", () => ({
  MemberColorSettingsControl: ({ color }: { color: string }) => <span data-member-color={color} />,
}));

const settingsModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "owner-id", email: "ada@example.com", householdId: "household-id", role: "owner",
  });
  mocks.from.mockImplementation((table: string) => table === "household_members"
    ? { select: mocks.memberSelect }
    : table === "member_cards"
      ? { select: mocks.cardSelect }
    : table === "profiles"
      ? { select: mocks.profileSelect }
      : table === "households"
        ? { select: mocks.householdSelect }
      : { select: mocks.authorizationSelect });
  mocks.memberSelect.mockReturnValue({ eq: mocks.memberEq });
  mocks.memberEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.memberOrder.mockResolvedValue({ data: [{ user_id: "owner-id", role: "owner", color: "#dcece3" }], error: null });
  mocks.memberSelect.mockImplementation((columns: string) => columns === "user_id, role, color, joined_at"
    ? { eq: mocks.colorHouseholdEq }
    : { eq: mocks.memberEq });
  mocks.colorHouseholdEq.mockReturnValue({ order: mocks.memberOrder });
  mocks.authorizationSelect.mockReturnValue({ eq: mocks.authorizationEq });
  mocks.authorizationEq.mockReturnValue({ maybeSingle: mocks.authorizationMaybeSingle });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.cardSelect.mockReturnValue({ eq: mocks.cardHouseholdEq });
  mocks.cardHouseholdEq.mockReturnValue(mocks.cardList);
  mocks.cardList.mockResolvedValue({ data: [{ user_id: "owner-id", last_four: "4548" }], error: null });
  mocks.profileSelect.mockImplementation((columns: string) => columns === "id, full_name"
    ? { eq: mocks.partnerProfileEq }
    : { eq: mocks.profileEq });
  mocks.profileEq.mockReturnValue({ maybeSingle: mocks.profileMaybeSingle });
  mocks.profileMaybeSingle.mockResolvedValue({ data: { full_name: "Ada Lovelace" }, error: null });
  mocks.partnerProfileEq.mockReturnValue({ maybeSingle: mocks.partnerProfileMaybeSingle });
  mocks.partnerProfileMaybeSingle.mockResolvedValue({ data: { id: "partner-id", full_name: "Grace Hopper" }, error: null });
  mocks.householdSelect.mockReturnValue({ eq: mocks.householdEq });
  mocks.householdEq.mockReturnValue({ maybeSingle: mocks.householdMaybeSingle });
  mocks.householdMaybeSingle.mockResolvedValue({ data: { name: "The Lovelaces" }, error: null });
});

it("renders Appearance, Household, and Account cards", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain("Appearance");
  expect(markup).toContain("Household");
  expect(markup).toContain("Account");
  expect(markup).toContain('aria-label="Save changes"');
  expect(markup).toContain("The Lovelaces");
  expect(markup).toContain("User color");
  expect(markup).toContain("User name");
  expect(markup).toContain('aria-label="Log out"');
  expect(markup).not.toContain("End this browser session");
  expect(markup).not.toMatch(/>Name<\/p>/);
  expect(markup).toContain("Last 4 digits");
  expect(markup).not.toContain("Card ending");
  expect(markup).toContain('name="profileName" value="Ada Lovelace"');
  expect(markup).not.toContain('aria-label="Save household name"');
  expect(markup.match(/w-\[min\(22rem,55vw\)\]/g)).toHaveLength(4);
  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.from).toHaveBeenCalledWith("households");
  expect(mocks.profileEq).toHaveBeenCalledWith("id", "owner-id");
  expect(markup.indexOf("Household")).toBeLessThan(markup.indexOf("Account"));
});

it("derives the empty owner state through the member request context", async () => {
  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain('data-partner-state="empty"');
  expect(markup).toContain(">Members</p>");
  expect(markup).toContain("Manage members.");
  expect(markup).toContain('aria-label="Manage members"');
  expect(mocks.from).toHaveBeenCalledWith("household_members");
  expect(mocks.from).toHaveBeenCalledWith("household_allowed_members");
  expect(mocks.from).toHaveBeenCalledWith("profiles");
  expect(mocks.colorHouseholdEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.authorizationEq).toHaveBeenCalledWith("household_id", "household-id");
});

it("renders pending partner access for an owner authorization without a joined member", async () => {
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: { email: "partner@example.com" }, error: null });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).toContain('data-partner-state="pending"');
  expect(markup).toContain("partner@example.com");
  expect(markup).toContain("Manage members.");
});

it("renders joined partner access for an owner authorization with a joined member", async () => {
  mocks.memberOrder.mockResolvedValue({
    data: [
      { user_id: "owner-id", role: "owner", color: "#dcece3" },
      { user_id: "partner-id", role: "member", color: "#123456" },
    ],
    error: null,
  });
  mocks.authorizationMaybeSingle.mockResolvedValue({ data: { email: "partner@example.com" }, error: null });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).not.toContain('data-household-members="true"');
  expect(markup).toContain(">Members</p>");
  expect(markup).toContain("Manage members.");
  expect(markup).toContain('aria-label="Manage members"');
  expect(markup).not.toContain("Owner");
  expect(markup).not.toContain(">Member</span>");
  expect(markup).not.toMatch(/>Name<\/p>/);
  expect(markup).not.toMatch(/>Role<\/p>/);
  expect(mocks.partnerProfileEq).toHaveBeenCalledWith("id", "partner-id");
});

it("does not query partner authorization for a member", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, userId: "member-id", email: "member@example.com", householdId: "household-id", role: "member",
  });

  const markup = renderToStaticMarkup(await settingsModule.default());

  expect(markup).not.toContain(">Members</p>");
  expect(markup).not.toContain('aria-label="Manage members"');
  expect(mocks.authorizationSelect).not.toHaveBeenCalled();
});
