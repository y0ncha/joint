import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PillSelect } from "./pill-select";

it("renders a colorless option with the muted fallback style", () => {
  const markup = renderToStaticMarkup(
    <PillSelect
      ariaLabel="Members"
      options={[{ value: "unassigned", label: "Unassigned" }]}
      value="unassigned"
    />,
  );

  expect(markup).toContain("border-muted-foreground/20 bg-muted text-muted-foreground");
});
