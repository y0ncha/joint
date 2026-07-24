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

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function reusableCategoryColors(colors: Iterable<string | null | undefined>) {
  return [...new Set(Array.from(colors, (color) => color?.toLowerCase()).filter((color): color is string => isHexColor(color) && !isSharedPastelColor(color)))];
}
