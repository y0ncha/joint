import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { PillSelect } from "./pill-select";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

it("renders a semantic class for the selected pill", () => {
  const markup = renderToStaticMarkup(
    <PillSelect
      ariaLabel="Type"
      value="expense"
      options={[{ value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" }]}
    />,
  );

  expect(markup).toContain("text-negative");
  expect(markup).not.toContain("border-muted-foreground/20 bg-muted text-muted-foreground");
});

it("associates destination validation feedback with its trigger", () => {
  const markup = renderToStaticMarkup(
    <PillSelect ariaLabel="Automation destination" ariaDescribedBy="destination-error" ariaInvalid options={[]} />,
  );

  expect(markup).toContain('aria-invalid="true"');
  expect(markup).toContain('aria-describedby="destination-error"');
});

it("renders ungrouped choices before labelled category sections with separators", () => {
  const markup = renderToStaticMarkup(
    <PillSelect
      ariaLabel="Categories"
      grouped
      options={[
        { value: "", label: "Uncategorized" },
        { value: "internet", label: "Internet", section: { id: "bills", label: "Bills" } },
      ]}
    />,
  );

  expect(markup).toContain("Uncategorized");
  expect(markup.lastIndexOf("Uncategorized")).toBeLessThan(markup.indexOf('id="pill-select-section-bills"'));
  expect(markup).toContain('data-slot="separator"');
  expect(markup).toContain('aria-labelledby="pill-select-section-bills"');
  expect(markup).toContain("Bills");
  expect(markup).toContain("Internet");
});

it("renders an option description in the selector", () => {
  const markup = renderToStaticMarkup(
    <PillSelect
      ariaLabel="Categories"
      grouped
      options={[{ value: "", label: "Uncategorized", description: "Choose automatically when you save." }]}
    />,
  );

  expect(markup).toContain("Choose automatically when you save.");
});
