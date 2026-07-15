import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const accountFormModule = await import("./account-form").catch(() => null);

it("offers the required shared-bank account setup fields", () => {
  const markup = accountFormModule ? renderToStaticMarkup(<accountFormModule.AccountForm />) : "";
  expect(markup).toContain("Add bank account");
  expect(markup).toContain("Opening balance");
});
