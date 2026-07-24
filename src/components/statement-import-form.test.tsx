import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { StatementImportForm } from "./statement-import-form";

it("renders a large, muted CSV drop zone that preserves XLSX support", () => {
  const markup = renderToStaticMarkup(<StatementImportForm />);

  expect(markup).toContain("Drop your file here");
  expect(markup).toContain("Tap to browse · CSV or XLSX");
  expect(markup).toContain('type="file"');
  expect(markup).toContain('name="statement"');
  expect(markup).toContain('accept=".csv,.xlsx"');
  expect(markup).toContain("Process file");
  expect(markup).not.toContain("כרטיס");
  expect(markup).not.toContain('name="category"');
});
