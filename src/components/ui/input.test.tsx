import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Input } from "./input";

it("uses a light filled surface instead of a transparent input", () => {
  const markup = renderToStaticMarkup(<Input id="example" />);

  expect(markup).toContain('data-slot="input"');
  expect(markup).toContain("bg-white/60");
});
