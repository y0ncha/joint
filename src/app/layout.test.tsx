import type { Metadata } from "next";
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

import RootLayout, { metadata, viewport } from "./layout";

it("uses a translucent status bar for the mobile canvas", () => {
  expect((metadata as Metadata).appleWebApp).toMatchObject({
    capable: true,
    statusBarStyle: "black-translucent",
  });
  expect(viewport).toMatchObject({ themeColor: "#f6d4b8", viewportFit: "cover" });
});

it.each([
  ["#123456", "#123456"],
  [undefined, "#0f6b54"],
  ["neon-green", "#0f6b54"],
])("renders the %s cookie accent before client components load", async (cookieValue, accent) => {
  mocks.get.mockReturnValue(cookieValue ? { value: cookieValue } : undefined);

  const html = await RootLayout({ children: "Joint" });

  expect(html.props.style).toMatchObject({ "--primary": accent, "--ring": accent });
});
