import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const colorControlModule = await import("./member-color-settings-control").catch(() => null);

it("shows each member color picker inline", () => {
  const markup = colorControlModule
    ? renderToStaticMarkup(<colorControlModule.MemberColorSettingsControl members={[{ id: "member-id", label: "You", color: "#dcece3" }]} />)
    : "";

  expect(markup).toContain('aria-label="Paid by colors"');
  expect(markup).toContain("circle-picker");
  expect(markup).not.toContain("Manage");
  expect(readFileSync("src/components/member-color-settings-control.tsx", "utf8")).toContain("ColorPicker");
  expect(readFileSync("src/components/member-color-settings-control.tsx", "utf8")).toContain("presetColors={accentPresetColors}");
});
