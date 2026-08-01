import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: {
    status: "error" as const,
    formError: "Check the form details.",
    fieldErrors: { groceriesBudget: "Enter an amount greater than zero." },
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: () => [mocks.actionState, () => {}, false] };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) =>
    createElement("main", null, actions, children),
}));

const { SettingsForm } = await import("./settings-save-control");
const { GroceriesBudgetSettingsControl } = await import("./groceries-budget-settings-control");

it("associates the groceries budget validation error through the shared Settings form state", () => {
  const markup = renderToStaticMarkup(
    <SettingsForm userId="user-id">
      <GroceriesBudgetSettingsControl budget={500} />
    </SettingsForm>,
  );

  expect(markup).toContain('name="initialGroceriesBudget" value="500"');
  expect(markup).toContain('id="groceries-budget"');
  expect(markup).toContain('name="groceriesBudget"');
  expect(markup).not.toContain('form="settings-save-form"');
  expect(markup).toMatch(/<form[^>]*id="settings-save-form"[^>]*>(?:(?!<\/form>)[\s\S])*name="groceriesBudget"/);
  expect(markup).toContain('min="0.01"');
  expect(markup).toContain('step="0.01"');
  expect(markup).toContain('aria-invalid="true"');
  expect(markup).toContain('aria-describedby="groceries-budget-error"');
  expect(markup).toContain('id="groceries-budget-error"');
  expect(markup).toContain('role="alert"');
  expect(markup).toContain("Enter an amount greater than zero.");
});
