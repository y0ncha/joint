import { RE2JS } from "re2js";

export type MerchantMatchMode = "contains" | "equals" | "starts_with" | "ends_with" | "advanced";
export type LiteralMerchantMatchMode = Exclude<MerchantMatchMode, "advanced">;

export const merchantMatchModeOptions: ReadonlyArray<{ value: LiteralMerchantMatchMode; label: string }> = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Is exactly" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
];

const modeLabels: Record<MerchantMatchMode, string> = {
  contains: "Contains",
  equals: "Is exactly",
  starts_with: "Starts with",
  ends_with: "Ends with",
  advanced: "Matches regex",
};

export function encodeMerchantPattern(mode: MerchantMatchMode, value: string) {
  const trimmedValue = value.trim();
  if (mode === "advanced") return trimmedValue;

  const quotedValue = RE2JS.quote(trimmedValue);
  if (mode === "equals") return `^${quotedValue}$`;
  if (mode === "starts_with") return `^${quotedValue}`;
  if (mode === "ends_with") return `${quotedValue}$`;
  return quotedValue;
}

function decodeQuotedLiteral(value: string) {
  const metacharacters = "\\.+*?()|[]{}^$";
  let literal = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "\\") {
      const escaped = value[index + 1];
      if (!escaped || !metacharacters.includes(escaped)) return null;
      literal += escaped;
      index += 1;
    } else {
      if (metacharacters.includes(character)) return null;
      literal += character;
    }
  }

  return literal;
}

export function decodeMerchantPattern(pattern: string): { mode: MerchantMatchMode; value: string } {
  const candidates: Array<{ mode: LiteralMerchantMatchMode; quotedValue: string }> = [];
  if (pattern.startsWith("^") && pattern.endsWith("$")) candidates.push({ mode: "equals", quotedValue: pattern.slice(1, -1) });
  if (pattern.startsWith("^")) candidates.push({ mode: "starts_with", quotedValue: pattern.slice(1) });
  if (pattern.endsWith("$")) candidates.push({ mode: "ends_with", quotedValue: pattern.slice(0, -1) });
  candidates.push({ mode: "contains", quotedValue: pattern });

  for (const candidate of candidates) {
    const value = decodeQuotedLiteral(candidate.quotedValue);
    if (value !== null && encodeMerchantPattern(candidate.mode, value) === pattern) return { mode: candidate.mode, value };
  }

  return { mode: "advanced", value: pattern.trim() };
}

export function describeMerchantPattern(pattern: string) {
  const decoded = decodeMerchantPattern(pattern);
  return `${modeLabels[decoded.mode]} “${decoded.value}”`;
}
