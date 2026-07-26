import { describe, expect, test } from "vitest";

import * as sharedColors from "./shared-colors";

const colors = sharedColors as unknown as {
  categoryPastelColors: readonly string[];
  isCategoryPastelColor: (value: unknown) => boolean;
  selectCategoryPastelColor: (usedColors: Iterable<string | null | undefined>, random?: () => number) => string;
};

describe("category pastel colors", () => {
  test("exposes the exact registry and selects unused colors before reusing them", () => {
    expect(colors.categoryPastelColors).toEqual([
      "#f1f5f9",
      "#e2e8f0",
      "#f3f4f6",
      "#e5e7eb",
      "#f4f4f5",
      "#e4e4e7",
      "#f5f5f5",
      "#e5e5e5",
      "#f5f5f4",
      "#e7e5e4",
      "#fee2e2",
      "#fecaca",
      "#ffedd5",
      "#fed7aa",
      "#fef3c7",
      "#fde68a",
      "#fef9c3",
      "#fef08a",
      "#ecfccb",
      "#d9f99d",
      "#dcfce7",
      "#bbf7d0",
      "#d1fae5",
      "#a7f3d0",
      "#ccfbf1",
      "#99f6e4",
      "#cffafe",
      "#a5f3fc",
      "#e0f2fe",
      "#bae6fd",
      "#dbeafe",
      "#bfdbfe",
      "#e0e7ff",
      "#c7d2fe",
      "#ede9fe",
      "#ddd6fe",
      "#f3e8ff",
      "#e9d5ff",
      "#fae8ff",
      "#f5d0fe",
      "#fce7f3",
      "#fbcfe8",
      "#ffe4e6",
      "#fecdd3",
      "#dcece3",
      "#ece5f4",
    ]);
    expect(new Set(colors.categoryPastelColors)).toHaveLength(46);
    expect(colors.categoryPastelColors).toHaveLength(46);
    expect(colors.categoryPastelColors.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);

    expect(colors.categoryPastelColors.every(colors.isCategoryPastelColor)).toBe(true);
    expect(colors.isCategoryPastelColor("#dcecf2")).toBe(false);
    expect(colors.isCategoryPastelColor("#ffffff")).toBe(false);

    expect(colors.selectCategoryPastelColor(["#F1F5F9"], () => 0)).toBe("#e2e8f0");
    expect(colors.selectCategoryPastelColor(["#F1F5F9"], () => 0.999)).toBe("#ece5f4");
    expect(colors.selectCategoryPastelColor(colors.categoryPastelColors, () => 0.999)).toBe("#ece5f4");
  });
});
