import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const roots = ["src/app", "src/components"];

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return fullPath.includes(`${join("src", "components", "ui")}`) ? [] : sourceFiles(fullPath);
    }

    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

describe("UI alignment", () => {
  it("keeps app surfaces on owned shadcn table and select primitives", () => {
    const offenders = roots
      .flatMap(sourceFiles)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /<(table|select)(\s|>)/.test(source);
      });

    expect(offenders).toEqual([]);
  });
});
