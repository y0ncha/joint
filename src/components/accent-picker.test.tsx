import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { AccentPicker } from "./accent-picker";

it("uses circles with a custom BlockPicker popover for the browser-local accent", () => {
  const markup = renderToStaticMarkup(<AccentPicker />);
  const source = readFileSync("src/components/accent-picker.tsx", "utf8");

  expect(markup).toContain("Accent color");
  expect(source).toContain("ColorPicker");
  expect(source).toContain("presetColors={accentPresetColors}");
});

it("caches the recent-color snapshot used by the external store", () => {
  const source = readFileSync("src/components/accent-picker.tsx", "utf8");

  expect(source).toContain("let recentColorsSnapshot: string[] = [];");
  expect(source).toContain("if (rawColors === recentColorsRaw) return recentColorsSnapshot;");
});
