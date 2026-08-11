import { expect, it } from "vitest";

import { SelectContent } from "./select";

it("does not limit popper options to the trigger height", () => {
  const content = SelectContent({ children: null }).props.children;
  const viewport = content.props.children[1];

  expect(viewport.props.className).not.toContain("h-(--radix-select-trigger-height)");
});
