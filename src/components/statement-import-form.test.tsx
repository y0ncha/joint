import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { StatementImportForm } from "./statement-import-form";

it("renders one accessible CSV or XLSX upload without category selection", () => {
  const markup = renderToStaticMarkup(<StatementImportForm />);

  expect(markup).toContain("Statement file");
  expect(markup).toContain('type="file"');
  expect(markup).toContain('name="statement"');
  expect(markup).toContain('accept=".csv,.xlsx"');
  expect(markup).toContain("1 MiB");
  expect(markup).toContain("כרטיס");
  expect(markup).toContain("בית עסק");
  expect(markup).toContain("תאריך עסקה");
  expect(markup).toContain("פירוט");
  expect(markup).toContain("סכום החיוב");
  expect(markup).toContain("unassigned");
  expect(markup).not.toContain('name="category"');
});

it("keeps submission feedback server-driven and accessible", () => {
  const source = readFileSync("src/components/statement-import-form.tsx", "utf8");

  expect(source).toContain("importStatement");
  expect(source).toContain('aria-live="polite"');
  expect(source).toContain("isPending");
  expect(source).toContain("FieldError");
  expect(source).not.toContain("parseStatementFile");
  expect(source).not.toContain("Select");
});
