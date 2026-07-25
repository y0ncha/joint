import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const colorControlModule = await import("./member-color-settings-control").catch(() => null);

it("labels the current member color control", () => {
  const markup = colorControlModule ? renderToStaticMarkup(<colorControlModule.MemberColorSettingsControl color="#dcece3" />) : "";

  expect(markup).toContain('aria-label="User color"');
  expect(markup).toContain("#f5e2eb");
  expect(markup).not.toContain("sm:grid-cols-2");
});
