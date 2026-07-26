import { describe, expect, test } from "vitest";

import * as sharedColors from "./shared-colors";

const colors = sharedColors as unknown as {
  categoryColorFamilies: readonly { category: string; subcategories: readonly string[] }[];
  categoryPastelColors: readonly string[];
  isCategoryPastelColor: (value: unknown) => boolean;
  selectCategoryPastelColor: (usedColors: Iterable<string | null | undefined>, random?: () => number) => string;
  subcategoryPastelColors: (categoryColor: string) => readonly string[];
  isSubcategoryPastelColor: (categoryColor: string, value: unknown) => boolean;
  selectSubcategoryPastelColor: (
    categoryColor: string,
    usedColors: Iterable<string | null | undefined>,
    random?: () => number,
  ) => string | null;
};

describe("category pastel colors", () => {
  test("selects unused category anchors before reusing them", () => {
    expect(colors.categoryPastelColors).toEqual(["#ccebef", "#ffcff0", "#f8d7d7", "#efeffc", "#ffeee6", "#d5d5c4"]);
    expect(new Set(colors.categoryPastelColors)).toHaveLength(6);
    expect(colors.categoryPastelColors).toHaveLength(6);
    expect(colors.categoryPastelColors.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);

    expect(colors.categoryPastelColors.every(colors.isCategoryPastelColor)).toBe(true);
    expect(colors.isCategoryPastelColor("#c5e8f7")).toBe(false);
    expect(colors.isCategoryPastelColor("#ffffff")).toBe(false);

    expect(colors.selectCategoryPastelColor(["#CCEBEF"], () => 0)).toBe("#ffcff0");
    expect(colors.selectCategoryPastelColor(colors.categoryPastelColors, () => 0.999)).toBe("#d5d5c4");
  });

  test("keeps subcategory colors within their parent family and reuses only after exhaustion", () => {
    expect(colors.categoryColorFamilies).toEqual([
      { category: "#ccebef", subcategories: ["#d9f0fa", "#cadae0", "#ced9e3", "#dce4ea"] },
      { category: "#ffcff0", subcategories: ["#ffbff4", "#cdb5ff", "#d9c3ff", "#ebd3ed"] },
      { category: "#f8d7d7", subcategories: ["#ffe1e8", "#ffedec", "#ffeaca", "#ffedd9"] },
      { category: "#efeffc", subcategories: ["#e6d5e6", "#e9c1e9", "#f4aef4", "#ebccff"] },
      { category: "#ffeee6", subcategories: ["#f0e4d9", "#e3d9cc", "#dce4ea", "#efeffc"] },
      { category: "#d5d5c4", subcategories: ["#ecece7", "#e2e2dd", "#c8c8ad", "#bcbcac"] },
    ]);
    expect(colors.subcategoryPastelColors("#CCEBEF")).toEqual(["#d9f0fa", "#cadae0", "#ced9e3", "#dce4ea"]);
    expect(colors.isSubcategoryPastelColor("#ccebef", "#d9f0fa")).toBe(true);
    expect(colors.isSubcategoryPastelColor("#ccebef", "#ffbff4")).toBe(false);
    expect(colors.selectSubcategoryPastelColor("#ccebef", ["#D9F0FA"], () => 0)).toBe("#cadae0");
    expect(colors.selectSubcategoryPastelColor("#ccebef", ["#d9f0fa", "#cadae0", "#ced9e3", "#dce4ea"], () => 0.999)).toBe("#dce4ea");
    expect(colors.selectSubcategoryPastelColor("#ffffff", [], () => 0)).toBeNull();
  });
});
