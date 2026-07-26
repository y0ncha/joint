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

export const categoryColorFamilies = [
  { category: "#ccebef", subcategories: ["#d9f0fa", "#cadae0", "#ced9e3", "#dce4ea"] },
  { category: "#ffcff0", subcategories: ["#ffbff4", "#cdb5ff", "#d9c3ff", "#ebd3ed"] },
  { category: "#f8d7d7", subcategories: ["#ffe1e8", "#ffedec", "#ffeaca", "#ffedd9"] },
  { category: "#efeffc", subcategories: ["#e6d5e6", "#e9c1e9", "#f4aef4", "#ebccff"] },
  { category: "#ffeee6", subcategories: ["#f0e4d9", "#e3d9cc", "#dce4ea", "#efeffc"] },
  { category: "#d5d5c4", subcategories: ["#ecece7", "#e2e2dd", "#c8c8ad", "#bcbcac"] },
] as const;

export const categoryPastelColors = categoryColorFamilies.map(({ category }) => category);

export type CategoryPastelColor = (typeof categoryPastelColors)[number];

export function isCategoryPastelColor(value: unknown): value is CategoryPastelColor {
  return typeof value === "string" && categoryPastelColors.includes(value.toLowerCase() as CategoryPastelColor);
}

export function selectCategoryPastelColor(usedColors: Iterable<string | null | undefined>, random = Math.random): CategoryPastelColor {
  const used = new Set(Array.from(usedColors, (color) => color?.toLowerCase()));
  const available = categoryPastelColors.filter((color) => !used.has(color));
  const colors = available.length > 0 ? available : categoryPastelColors;

  return colors[Math.min(Math.floor(random() * colors.length), colors.length - 1)];
}

export function subcategoryPastelColors(categoryColor: string) {
  return categoryColorFamilies.find(({ category }) => category === categoryColor.toLowerCase())?.subcategories ?? [];
}

export function isSubcategoryPastelColor(categoryColor: string, value: unknown): boolean {
  return typeof value === "string" && subcategoryPastelColors(categoryColor).includes(value.toLowerCase() as never);
}

export function selectSubcategoryPastelColor(categoryColor: string, usedColors: Iterable<string | null | undefined>, random = Math.random) {
  const colors = subcategoryPastelColors(categoryColor);
  if (colors.length === 0) return null;
  const used = new Set(Array.from(usedColors, (color) => color?.toLowerCase()));
  const available = colors.filter((color) => !used.has(color));
  const candidates = available.length > 0 ? available : colors;
  return candidates[Math.min(Math.floor(random() * candidates.length), candidates.length - 1)];
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}
