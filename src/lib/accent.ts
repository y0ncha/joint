export const ACCENT_COOKIE_NAME = "joint-accent";

export const accentOptions = [
  { name: "mint", label: "Mint", description: "Grounded green", swatch: "#0f6b54" },
  { name: "sky", label: "Sky", description: "Calm blue", swatch: "#236a8d" },
  { name: "lilac", label: "Lilac", description: "Soft violet", swatch: "#7056a3" },
  { name: "clay", label: "Clay", description: "Warm earth", swatch: "#aa583e" },
  { name: "blush", label: "Blush", description: "Dusty rose", swatch: "#a14b78" },
] as const;

export type AccentName = (typeof accentOptions)[number]["name"];

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === "string" && accentOptions.some((accent) => accent.name === value);
}

export function normalizeAccentName(value: unknown): AccentName {
  if (value === "peach" || value === "terracotta") return "clay";

  return isAccentName(value) ? value : "mint";
}

export function serializeAccentCookie(value: unknown, secure: boolean) {
  return `${ACCENT_COOKIE_NAME}=${normalizeAccentName(value)}; Max-Age=31536000; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
