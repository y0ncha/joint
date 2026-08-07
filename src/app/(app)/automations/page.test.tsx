import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMerchantAutomationRulesPage: vi.fn(),
}));

vi.mock("@/lib/merchant-automations", () => ({
  getMerchantAutomationRulesPage: mocks.getMerchantAutomationRulesPage,
}));
vi.mock("@/components/automation-rules-workspace", () => ({
  AutomationRulesWorkspace: (props: object) => <pre>{JSON.stringify(props)}</pre>,
}));

const automationsPage = await import("./page");

it("loads the authenticated rules workspace data through the Phase 3 page reader", async () => {
  mocks.getMerchantAutomationRulesPage.mockResolvedValue({
    count: 1,
    rules: [{ id: "rule-id", action: "normalize_merchant", pattern: "shop", replacement: "Shop", enabled: true, position: 0 }],
    destinations: [],
    preview: { changes: [], conflicts: [], fingerprint: "[]" },
  });

  const markup = renderToStaticMarkup(await automationsPage.default());

  expect(mocks.getMerchantAutomationRulesPage).toHaveBeenCalledWith();
  expect(markup).toContain("&quot;count&quot;:1");
  expect(markup).toContain("&quot;id&quot;:&quot;rule-id&quot;");
  expect(markup).toContain("&quot;fingerprint&quot;:&quot;[]&quot;");
});
