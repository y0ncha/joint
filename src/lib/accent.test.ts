import { describe, expect, it } from "vitest";

import { ACCENT_COOKIE_NAME, accentOptions, isAccentName, normalizeAccentName, serializeAccentCookie } from "./accent";

describe("personal accent preferences", () => {
  it("exposes five named palette options for the appearance picker", () => {
    expect(accentOptions.map((accent) => accent.name)).toEqual([
      "mint",
      "sky",
      "lilac",
      "clay",
      "blush",
    ]);
  });

  it("defines a swatch color for every palette option", () => {
    expect(accentOptions.every((accent) => "swatch" in accent)).toBe(true);
    expect(accentOptions.find((accent) => accent.name === "clay")).toMatchObject({ swatch: "#aa583e" });
  });

  it("migrates renamed preferences and falls back for unknown values", () => {
    expect(ACCENT_COOKIE_NAME).toBe("joint-accent");
    expect(isAccentName("lilac")).toBe(true);
    expect(isAccentName("neon-green")).toBe(false);
    expect(normalizeAccentName("sky")).toBe("sky");
    expect(normalizeAccentName("peach")).toBe("clay");
    expect(normalizeAccentName("terracotta")).toBe("clay");
    expect(normalizeAccentName("neon-green")).toBe("mint");
    expect(normalizeAccentName(null)).toBe("mint");
  });

  it("serializes a site-wide cookie and adds Secure only on HTTPS", () => {
    expect(serializeAccentCookie("sky", true)).toBe("joint-accent=sky; Max-Age=31536000; Path=/; SameSite=Lax; Secure");
    expect(serializeAccentCookie("invalid", false)).toBe("joint-accent=mint; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});
