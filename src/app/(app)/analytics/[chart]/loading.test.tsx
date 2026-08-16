import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("shows an accessible chart-detail placeholder before chart data resolves", async () => {
  const { default: AnalyticsDetailLoading } = await import("./loading");
  const markup = renderToStaticMarkup(<AnalyticsDetailLoading />);

  expect(markup).toContain("Loading Analytics…");
  expect(markup).toContain("Loading chart…");
  expect(markup.match(/data-slot=\"card\"/g)).toHaveLength(1);
});
