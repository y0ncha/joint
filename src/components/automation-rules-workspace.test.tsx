import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

const workspaceModule = await import("./automation-rules-workspace").catch(() => null);

it("renders ordered atomic automation rules with conflict guidance", () => {
  const markup = workspaceModule
    ? renderToStaticMarkup(
        <workspaceModule.AutomationRulesWorkspace
          rules={[
            { id: "normalize", action: "normalize_merchant", pattern: "ארומה", replacement: "Aroma", enabled: true, position: 0 },
            { id: "category", action: "assign_category", pattern: "ארומה", destination: "Food → Cafe", enabled: true, position: 1 },
          ]}
        />,
      )
    : "";

  expect(markup).toContain("Automations");
  expect(markup).toContain("Priority decides which matching rule wins.");
  expect(markup).toContain("Normalize merchant");
  expect(markup).toContain("Assign category");
  expect(markup).toContain("Aroma");
  expect(markup).toContain("Food → Cafe");
  expect(markup).toContain('aria-label="Add rule"');
  expect(markup).not.toContain(">Add rule<");
});
