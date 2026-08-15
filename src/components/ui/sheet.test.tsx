import { Children, type ReactElement } from "react";
import { expect, it } from "vitest";

import { SheetContent } from "./sheet";

it("keeps the mobile sheet below the safe-area inset when callers remove padding", () => {
  const portal = SheetContent({ children: null, className: "p-0" });
  const content = Children.toArray(portal.props.children)[1] as ReactElement<{ className: string }>;

  expect(content.props.className).toContain("!pt-[env(safe-area-inset-top)]");
});

it("standardizes single-line sheet controls without resizing textareas", () => {
  const portal = SheetContent({ children: null });
  const content = Children.toArray(portal.props.children)[1] as ReactElement<{ className: string }>;

  expect(content.props.className).toContain("[&_[data-slot=input]]:h-11");
  expect(content.props.className).toContain("[&_[data-slot=input]]:w-full");
  expect(content.props.className).toContain("[&_[data-slot=input]:not(.rounded-none)]:rounded-xl");
  expect(content.props.className).toContain("[&_[data-slot=select-trigger]]:h-11");
  expect(content.props.className).toContain("[&_[data-slot=select-trigger]]:w-full");
  expect(content.props.className).toContain("[&_[data-slot=select-trigger]]:rounded-xl");
  expect(content.props.className).not.toContain("[data-slot=textarea]");
});
