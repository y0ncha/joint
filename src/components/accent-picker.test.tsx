import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { AccentPicker } from "./accent-picker";

it("labels the browser-local accent control", () => {
  const markup = renderToStaticMarkup(<AccentPicker />);

  expect(markup).toContain("Accent color");
});
