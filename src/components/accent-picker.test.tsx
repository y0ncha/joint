import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { AccentPicker } from "./accent-picker";

it("shows accent options inline without a popover trigger", () => {
  const markup = renderToStaticMarkup(<AccentPicker />);

  expect(markup).toContain("Accent color");
  expect(markup).toContain("Mint");
  expect(markup).toContain("Sky");
  expect(markup).toContain("Lilac");
  expect(markup).toContain("Clay");
  expect(markup).toContain("Blush");
  expect(markup).not.toContain("bg-white/45");
  expect(markup).not.toContain("Choose your accent color");
  expect(markup).not.toContain("data-slot=\"popover-trigger\"");
  expect(markup).not.toContain("data-slot=\"popover-content\"");
});
