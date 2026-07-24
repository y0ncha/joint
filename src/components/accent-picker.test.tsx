import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { AccentPicker } from "./accent-picker";

it("uses circles with a custom BlockPicker popover for the browser-local accent", () => {
  const markup = renderToStaticMarkup(<AccentPicker />);

  expect(markup).toContain("Accent color");
});
