import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ColorPicker } from "./color-picker";

it("accepts caller-specific preset colors", () => {
  const markup = renderToStaticMarkup(<ColorPicker color="#123456" onChange={() => {}} presetColors={["#0f6b54"]} recentColors={["#abcdef"]} />);

  expect(markup).toContain("circle-picker");
  expect(markup).toContain('aria-label="Custom color"');
  expect(markup).not.toContain("#abcdef");
});
