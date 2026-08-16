import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("keeps the Budgets & Goals workspace chrome while both section cards load", async () => {
  const { default: BudgetsGoalsLoading } = await import("./loading");
  const markup = renderToStaticMarkup(<BudgetsGoalsLoading />);

  expect(markup).toContain("Budgets &amp; Goals");
  expect(markup).toContain("Loading Budgets &amp; Goals…");
  expect(markup.match(/data-slot="card"/g)).toHaveLength(2);
  expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(2);
  expect(markup).toContain("Loading");
});
