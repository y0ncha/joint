import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

import RootLayout from "./layout";

it.each([
  ["sky", "sky"],
  [undefined, "mint"],
  ["neon-green", "mint"],
])("renders the %s cookie accent before client components load", async (cookieValue, accent) => {
  mocks.get.mockReturnValue(cookieValue ? { value: cookieValue } : undefined);

  const html = await RootLayout({ children: "Joint" });

  expect(html.props["data-accent"]).toBe(accent);
});
