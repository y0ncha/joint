import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const colorControlModule = await import("./member-color-settings-control").catch(() => null);

it("labels the member color controls", () => {
  const markup = colorControlModule
    ? renderToStaticMarkup(<colorControlModule.MemberColorSettingsControl members={[{ id: "member-id", label: "You", color: "#dcece3" }]} />)
    : "";

  expect(markup).toContain('aria-label="Paid by colors"');
});
