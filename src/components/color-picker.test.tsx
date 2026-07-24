import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ColorPicker } from "./color-picker";

it("labels the custom color control", () => {
  const markup = renderToStaticMarkup(<ColorPicker color="#123456" onChange={() => {}} presetColors={["#0f6b54"]} recentColors={["#abcdef"]} />);

  expect(markup).toContain('aria-label="Custom color"');
});
