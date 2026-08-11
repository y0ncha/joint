import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardMembershipFallback } from "./dashboard-loading";
import { ProfileInitialAvatar, WorkspaceChrome } from "@/components/workspace-shell";
import type { MemberHouseholdContext } from "@/lib/household";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdContext: mocks.getCurrentHouseholdContext,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/" }));

import { MemberProfileSlot, MembershipGate } from "./layout";

describe("protected app layout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentHouseholdContext.mockResolvedValue({
      status: "member",
      householdId: "household-id",
      role: "member",
      userId: "member-id",
    });
  });

  it("releases children and the verified profile slot only for a member", async () => {
    const context = Promise.resolve({
      status: "member",
      householdId: "household-id",
      role: "member",
      userId: "member-id",
      email: "ada@example.com",
      supabase: {},
    } as MemberHouseholdContext);

    await expect(MembershipGate({ context, children: "protected page" })).resolves.toBe("protected page");
    expect(await MemberProfileSlot({ context })).not.toBeNull();
  });

  it("redirects unauthenticated and unmatched contexts without releasing children", async () => {
    await MembershipGate({ context: Promise.resolve({ status: "unauthenticated" }), children: "protected page" });

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(await MemberProfileSlot({ context: Promise.resolve({ status: "unmatched" }) })).not.toBeNull();
  });

  it("keeps protected children out of the pending chrome", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChrome profileSlot={<ProfileInitialAvatar name="" />}>
        <DashboardMembershipFallback />
      </WorkspaceChrome>,
    );

    expect(markup).toContain("Skip to page content");
    expect(markup).toContain("Loading dashboard controls");
    expect(markup).not.toContain("Ada Lovelace");
    expect(markup).not.toContain("₪12,000");
  });

  it("does not duplicate chrome, main landmarks, or dashboard headings during loading", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceChrome profileSlot={<ProfileInitialAvatar name="" />}>
        <DashboardMembershipFallback />
      </WorkspaceChrome>,
    );

    expect(markup.match(/<main/g)).toHaveLength(1);
    expect(markup.match(/Shared money/g)).toHaveLength(1);
    expect(markup.match(/aria-label="Primary navigation"/g)).toHaveLength(2);
  });
});
