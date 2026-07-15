import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHousehold: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const settingsModule = await import("./page").catch(() => null);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });
  mocks.createServerSupabaseClient.mockResolvedValue({ from: mocks.from });
  mocks.order.mockResolvedValue({
    data: [
      { user_id: "owner-id", role: "owner" },
      { user_id: "member-id", role: "member" },
    ],
    error: null,
  });
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
});

it("renders settings as section cards with row-style controls", async () => {
  const markup = settingsModule ? renderToStaticMarkup(await settingsModule.default()) : "";

  expect((markup.match(/data-slot="card"/g) ?? []).length).toBe(4);
  expect(markup).toContain("mt-6 flex w-full flex-col gap-5");
  expect(markup).not.toContain("max-w-4xl");
  expect(markup).toContain("Household members");
  expect(markup).toContain("Shared access");
  expect(markup).toContain("Appearance");
  expect(markup).toContain("Accent color");
  expect(markup).toContain("Monthly summary");
  expect(markup).toContain("Account");
  expect(markup).toContain("Session");
  expect(markup).toContain("Log out");
  expect((markup.match(/Log out/g) ?? []).length).toBe(1);
  expect(markup).toContain("End this browser session and return to sign in.");
  expect(markup).toContain("Invitations");
  expect(markup).toContain("Enter their Google email to create one invite link.");
  expect(markup).toContain("Partner&#x27;s Google email");
  expect(markup).not.toContain("Create a sign-in invitation for this household.");
  expect(markup).toContain("data-slot=\"select-trigger\"");
  expect(markup).toContain("data-settings-row");
});
