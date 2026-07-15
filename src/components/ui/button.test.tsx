import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Button } from "./button";

it("keeps outline buttons on a neutral light surface instead of the canvas color", () => {
  const markup = renderToStaticMarkup(<Button variant="outline">Save category</Button>);

  expect(markup).toContain("bg-white/60");
  expect(markup).toContain("hover:bg-white/80");
  expect(markup).not.toContain("bg-background");
});
