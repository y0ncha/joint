import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHousehold: vi.fn(),
  getDashboardData: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHousehold: mocks.getCurrentHousehold }));
vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: mocks.getDashboardData }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, usePathname: () => "/" }));

import Home from "./page";

describe("Joint dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims } });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } });
    mocks.getCurrentHousehold.mockResolvedValue({ householdId: "household-id", role: "owner" });
    mocks.getDashboardData.mockResolvedValue({
      setupRequired: false,
      accounts: [
        { id: "bank-id", name: "Shared bank", kind: "bank", archivedAt: null },
      ],
      categories: [
        { id: "income-category-id", name: "Salary", kind: "income", archivedAt: null },
        { id: "home-category-id", name: "Home", kind: "expense", archivedAt: null },
      ],
      currentUserId: "member-id",
      members: [{ id: "member-id", label: "You" }],
      report: {
        bankBalance: 18420,
        cardDebt: 0,
        income: 16400,
        expenses: 7940,
        categoryTotals: [{ categoryId: "home-category-id", categoryName: "Home", amount: 4280 }],
        recentTransactions: [
          {
            id: "transaction-id",
            kind: "expense",
            amount: 186,
            accountId: "bank-id",
            categoryId: "home-category-id",
            note: "Super Pharm",
            occurredOn: "2026-07-14",
            paidBy: "member-id",
          },
        ],
      },
    });
  });

  it("sends anonymous visitors to login before loading household data", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });

    await Home();

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getCurrentHousehold).not.toHaveBeenCalled();
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });

  it("shows the restored dashboard cards with live household values", async () => {
    const markup = renderToStaticMarkup(await Home());

    expect(markup).toContain("Add transaction");
    expect(markup).not.toContain("Choose your accent color");
    expect(markup).not.toContain("lucide-bell");
    expect(markup).toContain("Shared balance");
    expect(markup).toContain("Monthly flow");
    expect(markup).toContain("Where your money went");
    expect(markup).toContain("More chart options");
    expect(markup).toContain("Super Pharm");
    expect(markup).toContain("18,420");
    expect(markup).not.toContain("Upcoming card charge");
    expect(markup).not.toContain("Card debt");
    expect(markup).not.toContain("credit card");
    expect(markup).toContain('alt="Joint logo"');
    expect(markup).not.toContain("flaticon.com");
    expect(markup).not.toContain('data-slot="tooltip-trigger"');
  });
});
