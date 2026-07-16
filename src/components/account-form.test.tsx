import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const accountFormModule = await import("./account-form").catch(() => null);

it("offers the required shared-bank account setup fields", () => {
  const markup = accountFormModule ? renderToStaticMarkup(<accountFormModule.AccountForm />) : "";
  expect(markup).toContain("Add bank account");
  expect(markup).toContain("Opening balance");
  expect(readFileSync("src/components/account-form.tsx", "utf8")).toContain("Last 4 card digits");
  expect(readFileSync("src/components/account-form.tsx", "utf8")).toContain("Statement close day");
});
