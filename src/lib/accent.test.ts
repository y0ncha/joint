import { describe, expect, it } from "vitest";

import { ACCENT_STORAGE_KEY, accentOptions, isAccentName, normalizeAccentName } from "./accent";

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
    expect(ACCENT_STORAGE_KEY).toBe("joint-accent");
    expect(isAccentName("lilac")).toBe(true);
    expect(isAccentName("neon-green")).toBe(false);
    expect(normalizeAccentName("sky")).toBe("sky");
    expect(normalizeAccentName("peach")).toBe("clay");
    expect(normalizeAccentName("terracotta")).toBe("clay");
    expect(normalizeAccentName("neon-green")).toBe("mint");
    expect(normalizeAccentName(null)).toBe("mint");
  });
});
