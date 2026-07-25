import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { MemberCardSettingsControl } from "./member-card-settings-control";
import { TooltipProvider } from "@/components/ui/tooltip";

it("includes the card mapping in the shared settings form", () => {
  const markup = renderToStaticMarkup(
    <TooltipProvider>
      <MemberCardSettingsControl lastFour="4548" />
    </TooltipProvider>,
  );

  expect(markup).toContain('form="settings-save-form"');
  expect(markup).toContain('name="lastFour"');
  expect(markup).toContain('name="initialLastFour"');
  expect(markup).toContain('aria-label="Edit last four digits"');
});
