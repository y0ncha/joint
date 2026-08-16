import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

it("matches the Analytics chart grid before dashboard data resolves", async () => {
  const { default: AnalyticsLoading } = await import("./loading");
  const markup = renderToStaticMarkup(<AnalyticsLoading />);

  expect(markup).toContain("Analytics");
  expect(markup).toContain("Loading Analytics…");
  expect(markup.match(/data-slot=\"card\"/g)).toHaveLength(4);
  expect(markup).toContain("xl:grid-cols-5");
  expect(markup.match(/xl:col-span-5/g)).toHaveLength(2);
  expect(markup).toContain("xl:col-span-3");
  expect(markup).toContain("xl:col-span-2");
  expect(markup).toContain("motion-safe:animate-pulse");
  expect(markup).toContain("motion-reduce:animate-none");
});
