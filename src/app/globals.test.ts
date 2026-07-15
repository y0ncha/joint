import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("semantic financial colors", () => {
  it("keeps positive and negative trend colors independent from personal accents", () => {
    expect(globalsCss).toContain("--positive: #0f6b54;");
    expect(globalsCss).toContain("--negative: #9e3e35;");

    for (const accent of ["sky", "lilac", "clay", "blush"]) {
      const accentBlock = globalsCss.match(new RegExp(`:root\\[data-accent="${accent}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1];

      expect(accentBlock).toBeDefined();
      expect(accentBlock).not.toContain("--positive:");
      expect(accentBlock).not.toContain("--negative:");
    }
  });
});

describe("personal accent palettes", () => {
  it("uses a lighter clay primary", () => {
    const clayBlock = globalsCss.match(/:root\[data-accent="clay"\] \{([\s\S]*?)\n\}/)?.[1];

    expect(clayBlock).toContain("--primary: #aa583e;");
  });
});

describe("canvas background", () => {
  it("blends the warm and cool canvas colors as one continuous gradient", () => {
    expect(globalsCss).toMatch(
      /background:\s*linear-gradient\(135deg,\s*#f6d4b8 0%,\s*#b5cad0 62%,\s*#0d4f73 100%\);/,
    );
  });
});

describe("surface opacity", () => {
  it("keeps card surfaces more opaque than the initial glass baseline", () => {
    expect(globalsCss).toContain("--card: rgba(255, 252, 247, 0.92);");
  });
});
