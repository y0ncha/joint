import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { MemberCardSettingsControl } from "./member-card-settings-control";

it("keeps the card mapping inputs available to the shared settings form", () => {
  const markup = renderToStaticMarkup(<MemberCardSettingsControl lastFour="4548" />);

  expect(markup).not.toContain('form="settings-save-form"');
  expect(markup).toContain('name="lastFour"');
  expect(markup).toContain('name="initialLastFour"');
  expect(markup).toContain('aria-label="Edit last four digits"');
});
