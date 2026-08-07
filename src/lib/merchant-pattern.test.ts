import { describe, expect, it } from "vitest";

import {
  decodeMerchantPattern,
  describeMerchantPattern,
  encodeMerchantPattern,
  merchantMatchModeOptions,
  type MerchantMatchMode,
} from "./merchant-pattern";

describe("merchant match patterns", () => {
  it("encodes trimmed literals in the four canonical modes", () => {
    const cases: Array<{ mode: MerchantMatchMode; expected: string }> = [
      { mode: "contains", expected: "Aroma" },
      { mode: "equals", expected: "^Aroma$" },
      { mode: "starts_with", expected: "^Aroma" },
      { mode: "ends_with", expected: "Aroma$" },
    ];

    for (const { mode, expected } of cases) {
      expect(encodeMerchantPattern(mode, "  Aroma  ")).toBe(expected);
    }
  });

  it("preserves Hebrew literals through anchored round trips", () => {
    const encoded = encodeMerchantPattern("equals", "  סופר-פארם  ");

    expect(encoded).toBe("^סופר-פארם$");
    expect(decodeMerchantPattern(encoded)).toEqual({ mode: "equals", value: "סופר-פארם" });
  });

  it("quotes RE2 metacharacters instead of changing their meaning", () => {
    const literal = String.raw`A.B+[C](D)?^$\backslash`;
    const quoted = String.raw`A\.B\+\[C\]\(D\)\?\^\$\\backslash`;

    expect(encodeMerchantPattern("contains", literal)).toBe(quoted);
    expect(decodeMerchantPattern(quoted)).toEqual({ mode: "contains", value: literal });
  });

  it("decodes every canonical anchored pattern losslessly", () => {
    expect(decodeMerchantPattern("Corner Market")).toEqual({ mode: "contains", value: "Corner Market" });
    expect(decodeMerchantPattern("^Corner Market$")).toEqual({ mode: "equals", value: "Corner Market" });
    expect(decodeMerchantPattern("^Corner Market")).toEqual({ mode: "starts_with", value: "Corner Market" });
    expect(decodeMerchantPattern("Corner Market$")).toEqual({ mode: "ends_with", value: "Corner Market" });
    expect(decodeMerchantPattern(String.raw`^\^Corner\$$`)).toEqual({ mode: "equals", value: "^Corner$" });
  });

  it("keeps non-canonical raw regex patterns in legacy advanced mode", () => {
    expect(decodeMerchantPattern("(Aroma|Cafe)")).toEqual({ mode: "advanced", value: "(Aroma|Cafe)" });
    expect(decodeMerchantPattern("Aroma.*")).toEqual({ mode: "advanced", value: "Aroma.*" });
    expect(encodeMerchantPattern("advanced", "  (Aroma|Cafe)  ")).toBe("(Aroma|Cafe)");
  });

  it("offers exactly the four literal modes for new rules", () => {
    expect(merchantMatchModeOptions).toEqual([
      { value: "contains", label: "Contains" },
      { value: "equals", label: "Is exactly" },
      { value: "starts_with", label: "Starts with" },
      { value: "ends_with", label: "Ends with" },
    ]);
  });

  it("describes canonical and legacy patterns without exposing regex syntax as a literal", () => {
    expect(describeMerchantPattern("Aroma")).toBe("Contains “Aroma”");
    expect(describeMerchantPattern("^Corner Market$")).toBe("Is exactly “Corner Market”");
    expect(describeMerchantPattern("^Super")).toBe("Starts with “Super”");
    expect(describeMerchantPattern("Pharm$")).toBe("Ends with “Pharm”");
    expect(describeMerchantPattern("(Aroma|Cafe)")).toBe("Advanced pattern “(Aroma|Cafe)”");
  });
});
