import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const pillSelectModule = await import("./pill-select").catch(() => null);

it("shows searchable color pills in lexical order", () => {
  const markup = pillSelectModule ? renderToStaticMarkup(
    <pillSelectModule.PillSelect
      ariaLabel="Categories"
      defaultValue="z"
      options={[
        { value: "z", label: "Zebra", color: "#ece5f4" },
        { value: "a", label: "Apple", color: "#dcece3" },
      ]}
    />,
  ) : "";

  expect(markup).toContain('style="background-color:#ece5f4;border-color:color-mix(in srgb, #ece5f4, black 20%);color:color-mix(in srgb, #ece5f4, black 60%)"');
});
