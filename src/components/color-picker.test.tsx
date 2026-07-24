import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

import { ColorPicker } from "./color-picker";

it("accepts caller-specific preset colors", () => {
  const markup = renderToStaticMarkup(<ColorPicker color="#123456" onChange={() => {}} presetColors={["#0f6b54"]} recentColors={["#abcdef"]} />);

  expect(markup).toContain("circle-picker");
  expect(markup).toContain('aria-label="Custom color"');
  expect(markup).not.toContain("#abcdef");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("<BlockPicker");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("colors={blockColors}");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("presetColors = sharedPastelColors.map");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("colors={presetColors}");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("circleSize={24}");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("slice(0, 5)");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("Select");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("setPreviewColor");
  expect(readFileSync("src/components/color-picker.tsx", "utf8")).toContain("--selected-color");
});
