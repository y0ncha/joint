import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentHouseholdContext: vi.fn(),
}));

vi.mock("@/lib/household", () => ({ getCurrentHouseholdContext: mocks.getCurrentHouseholdContext }));
vi.mock("@/components/statement-import-form", () => ({ StatementImportForm: () => <span data-statement-import-form /> }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const pageModule = await import("./page");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentHouseholdContext.mockResolvedValue({
    status: "member",
    householdId: "household-id",
    role: "member",
    userId: "member-id",
  });
});

it("renders statement import for every verified household member without loading card mappings", async () => {
  const markup = renderToStaticMarkup(await pageModule.default());

  expect(markup).toContain("data-statement-import-form");
  expect(mocks.getCurrentHouseholdContext).toHaveBeenCalledOnce();
});

it("renders nothing when membership is unavailable", async () => {
  mocks.getCurrentHouseholdContext.mockResolvedValue({ status: "unmatched" });

  await expect(pageModule.default()).resolves.toBeNull();
});
