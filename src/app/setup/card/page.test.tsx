import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentHousehold: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  householdEq: vi.fn(),
  userEq: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ requireCurrentHousehold: mocks.requireCurrentHousehold }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/member-card-form", () => ({ MemberCardForm: () => <form data-member-card-form /> }));

const pageModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireCurrentHousehold.mockResolvedValue({
    status: "member", supabase: { from: mocks.from }, householdId: "household-id", userId: "member-id", role: "member",
  });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.householdEq });
  mocks.householdEq.mockReturnValue({ eq: mocks.userEq });
  mocks.userEq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
});

it("renders card setup only for the current member without a mapping", async () => {
  const markup = renderToStaticMarkup(await pageModule.default());

  expect(markup).toContain("Add your card");
  expect(markup).toContain("data-member-card-form");
  expect(mocks.requireCurrentHousehold).toHaveBeenCalledOnce();
});

it("checks the mapping through the verified household and member", async () => {
  await pageModule.default();

  expect(mocks.from).toHaveBeenCalledWith("member_card_mappings");
  expect(mocks.select).toHaveBeenCalledWith("user_id");
  expect(mocks.householdEq).toHaveBeenCalledWith("household_id", "household-id");
  expect(mocks.userEq).toHaveBeenCalledWith("user_id", "member-id");
});

it("redirects mapped members home", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: "member-id" }, error: null });

  await pageModule.default();

  expect(mocks.redirect).toHaveBeenCalledWith("/");
});

it("does not render setup when membership is unavailable", async () => {
  const error = new Error("This Google account does not have access to Joint.");
  mocks.requireCurrentHousehold.mockRejectedValue(error);

  await expect(pageModule.default()).rejects.toBe(error);
  expect(mocks.from).not.toHaveBeenCalled();
});
