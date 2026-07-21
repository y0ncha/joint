import { readFileSync } from "node:fs";
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

it("keeps submission feedback server-driven and accessible", () => {
  const source = readFileSync("src/components/statement-import-form.tsx", "utf8");

  expect(source).toContain("importStatement");
  expect(source).toContain('aria-live="polite"');
  expect(source).toContain("isPending");
  expect(source).toContain("FieldError");
  expect(source).not.toContain("parseStatementFile");
  expect(source).not.toContain("<Select");
});

it("shows the selected file in the drop zone", () => {
  const source = readFileSync("src/components/statement-import-form.tsx", "utf8");

  expect(source).toContain("Selected: {droppedFile.name}");
  expect(source).toContain("Tap to change file");
  expect(source).toContain("Processing file…");
  expect(source).toContain("LoaderCircle");
  expect(source).toContain("transactions added.");
});
