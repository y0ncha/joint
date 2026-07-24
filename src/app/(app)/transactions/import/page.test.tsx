import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const pageModule = await import("./page");

it("redirects to transactions with the import sidebar open", async () => {
  await pageModule.default();

  expect(mocks.redirect).toHaveBeenCalledWith("/transactions?import=1");
});
