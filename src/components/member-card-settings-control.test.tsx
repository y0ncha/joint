import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { MemberCardSettingsControl } from "./member-card-settings-control";

it("includes the card mapping in the shared settings form", () => {
  const markup = renderToStaticMarkup(<MemberCardSettingsControl lastFour="4548" />);

  expect(markup).toContain('form="settings-save-form"');
  expect(markup).toContain('name="lastFour"');
  expect(markup).toContain('name="initialLastFour"');
  expect(markup).toContain('aria-label="Edit last four digits"');
});
