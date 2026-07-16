import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const formsModule = await import("./onboarding-forms").catch(() => null);

it("captures the initial shared balance during household setup", () => {
  const markup = formsModule ? renderToStaticMarkup(<formsModule.CreateHouseholdForm />) : "";

  expect(markup).toContain("Your name");
  expect(markup).toContain("Household name");
  expect(markup).toContain("Initial shared balance");
  expect(markup).toContain("Balance date");
  expect(markup).toContain("Create household");
});
