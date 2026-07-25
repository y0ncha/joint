import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PillSelect } from "./pill-select";

it("renders a semantic class for the selected pill", () => {
  const markup = renderToStaticMarkup(
    <PillSelect
      ariaLabel="Type"
      value="expense"
      options={[{ value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" }]}
    />,
  );

  expect(markup).toContain("text-negative");
  expect(markup).not.toContain("border-muted-foreground/20 bg-muted text-muted-foreground");
});
