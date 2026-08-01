import { expect, it } from "vitest";

import { buttonVariants } from "./button";

it("uses one immediate hover and pressed treatment for icon buttons", () => {
  for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
    const classes = buttonVariants({ size, variant: "ghost" });
    expect(classes).toContain("[&[data-size^=icon]]:hover:bg-foreground/5");
    expect(classes).toContain("[&[data-size^=icon]]:active:bg-foreground/10");
    expect(classes).not.toContain("translate-y-px");
  }
});
