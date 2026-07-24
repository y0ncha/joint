import { describe, expect, it } from "vitest";

import { ACCENT_COOKIE_NAME, accentPresetColors, normalizeAccentColor, serializeAccentCookie } from "./accent";

describe("personal accent preferences", () => {
  it("accepts hex colors, migrates named preferences, and falls back for invalid values", () => {
    expect(ACCENT_COOKIE_NAME).toBe("joint-accent");
    expect(normalizeAccentColor("#123456")).toBe("#123456");
    expect(normalizeAccentColor("sky")).toBe("#236a8d");
    expect(normalizeAccentColor("peach")).toBe("#aa583e");
    expect(normalizeAccentColor("neon-green")).toBe("#0f6b54");
    expect(normalizeAccentColor(null)).toBe("#0f6b54");
  });

  it("keeps the original five accent swatches as presets", () => {
    expect(accentPresetColors).toEqual(["#0f6b54", "#236a8d", "#7056a3", "#aa583e", "#a14b78"]);
  });

  it("serializes a site-wide cookie and adds Secure only on HTTPS", () => {
    expect(serializeAccentCookie("#123456", true)).toBe("joint-accent=%23123456; Max-Age=31536000; Path=/; SameSite=Lax; Secure");
    expect(serializeAccentCookie("invalid", false)).toBe("joint-accent=%230f6b54; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});
