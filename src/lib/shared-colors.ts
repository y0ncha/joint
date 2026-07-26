export const sharedPastelColors = [
  { label: "Mint", value: "#dcece3" },
  { label: "Sky", value: "#dcecf2" },
  { label: "Lilac", value: "#ece5f4" },
  { label: "Clay", value: "#f6e3dc" },
  { label: "Blush", value: "#f5e2eb" },
] as const;

export type SharedPastelColor = (typeof sharedPastelColors)[number]["value"];

export function isSharedPastelColor(value: unknown): value is SharedPastelColor {
  return sharedPastelColors.some((color) => color.value === value);
}

export const categoryPastelColors = [
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
] as const;

export type CategoryPastelColor = (typeof categoryPastelColors)[number];

export function isCategoryPastelColor(value: unknown): value is CategoryPastelColor {
  return typeof value === "string" && categoryPastelColors.includes(value as CategoryPastelColor);
}

export function selectCategoryPastelColor(usedColors: Iterable<string | null | undefined>, random = Math.random): CategoryPastelColor {
  const used = new Set(Array.from(usedColors, (color) => color?.toLowerCase()));
  const available = categoryPastelColors.filter((color) => !used.has(color));
  const colors = available.length > 0 ? available : categoryPastelColors;

  return colors[Math.min(Math.floor(random() * colors.length), colors.length - 1)];
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function reusableCategoryColors(colors: Iterable<string | null | undefined>) {
  return [
    ...new Set(
      Array.from(colors, (color) => color?.toLowerCase()).filter(
        (color): color is string => isHexColor(color) && !isSharedPastelColor(color),
      ),
    ),
  ];
}
