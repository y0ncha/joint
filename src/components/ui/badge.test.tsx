import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Badge } from "./badge";

it("keeps shared pills comfortably compact", () => {
  const markup = renderToStaticMarkup(<Badge>Label</Badge>);

  expect(markup).toContain("h-6");
  expect(markup).toContain("px-2.5");
  expect(markup).toContain("text-xs");
});
