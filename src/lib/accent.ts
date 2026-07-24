import { isHexColor } from "@/lib/shared-colors";

export const ACCENT_COOKIE_NAME = "joint-accent";
export const DEFAULT_ACCENT = "#0f6b54";

const legacyAccents: Record<string, string> = {
  mint: DEFAULT_ACCENT,
  sky: "#236a8d",
  lilac: "#7056a3",
  clay: "#aa583e",
  blush: "#a14b78",
  peach: "#aa583e",
  terracotta: "#aa583e",
};

export const accentPresetColors = [...new Set(Object.values(legacyAccents))];

export function normalizeAccentColor(value: unknown) {
  if (isHexColor(value)) return value.toLowerCase();

  return typeof value === "string" ? legacyAccents[value] ?? DEFAULT_ACCENT : DEFAULT_ACCENT;
}

export function accentForeground(color: string) {
  const [red, green, blue] = color.slice(1).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16));
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#17201d" : "#ffffff";
}

export function serializeAccentCookie(value: unknown, secure: boolean) {
  return `${ACCENT_COOKIE_NAME}=${encodeURIComponent(normalizeAccentColor(value))}; Max-Age=31536000; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
