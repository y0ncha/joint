import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: null as null | { status: "error"; formError: string; fieldErrors: Record<string, string> },
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

const settingsModule = await import("./settings-save-control");
const { hasUnsavedSettings } = settingsModule;

function settingsData(values: Record<string, string>) {
  const formData = new FormData();
  Object.entries(values).forEach(([name, value]) => formData.set(name, value));
  return formData;
}

describe("hasUnsavedSettings", () => {
  it("detects changed settings without flagging unchanged fields", () => {
    expect(
      hasUnsavedSettings(settingsData({ profileName: "Ada", initialProfileName: "Ada", color: "#dcece3", initialColor: "#dcece3" })),
    ).toBe(false);
    expect(hasUnsavedSettings(settingsData({ profileName: "Ada Lovelace", initialProfileName: "Ada" }))).toBe(true);
    expect(hasUnsavedSettings(settingsData({ accentColor: "#236a8d", initialAccentColor: "#0f6b54" }))).toBe(true);
    expect(hasUnsavedSettings(settingsData({ lastFour: "4548", initialLastFour: "" }))).toBe(true);
    expect(hasUnsavedSettings(settingsData({ groceriesBudget: "500", initialGroceriesBudget: "" }))).toBe(true);
    expect(hasUnsavedSettings(settingsData({ groceriesBudget: "", initialGroceriesBudget: "500" }))).toBe(true);
  });
});

it("shares the save action state with descendant Settings fields while retaining the existing form and header controls", () => {
  mocks.actionState = { status: "error", formError: "Invalid settings", fieldErrors: { groceriesBudget: "Enter a valid amount." } };
  const ActionState = () => {
    const state = settingsModule.useSettingsFormState();
    return createElement("output", null, state?.status === "error" ? state.fieldErrors.groceriesBudget : null);
  };

  const markup = renderToStaticMarkup(
    createElement(settingsModule.SettingsForm, { userId: "user-id", children: createElement(ActionState) }),
  );

  expect(markup).toContain('id="settings-save-form"');
  expect(markup).toContain('aria-label="Save changes"');
  expect(markup).toContain('aria-label="Log out"');
  expect(markup).toContain("Enter a valid amount.");
});
