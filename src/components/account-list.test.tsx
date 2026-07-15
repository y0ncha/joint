import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
const listModule = await import("./account-list").catch(() => null);
it("shows a truthful empty state", () => {
  const markup = listModule ? renderToStaticMarkup(<listModule.AccountList accounts={[]} />) : "";
  expect(markup).toContain("No accounts yet");
});
