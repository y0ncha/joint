import { Children, type ReactElement } from "react";
import { expect, it } from "vitest";

import { SheetContent } from "./sheet";

it("keeps the mobile sheet below the safe-area inset when callers remove padding", () => {
  const portal = SheetContent({ children: null, className: "p-0" });
  const content = Children.toArray(portal.props.children)[1] as ReactElement<{ className: string }>;

  expect(content.props.className).toContain("!pt-[env(safe-area-inset-top)]");
});
