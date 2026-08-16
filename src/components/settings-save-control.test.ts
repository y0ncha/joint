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
  WorkspacePage: ({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) =>
    createElement("section", { id: "workspace-content" }, actions, children),
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
  });
});

it("submits Settings descendants through the save form while retaining header controls", () => {
  mocks.actionState = { status: "error", formError: "Invalid settings", fieldErrors: { profileName: "Enter a display name." } };
  const ActionState = () => {
    const state = settingsModule.useSettingsFormState();
    return createElement(
      "output",
      null,
      state?.status === "error" ? state.fieldErrors.profileName : null,
      createElement("input", { name: "profileName", value: "", readOnly: true }),
    );
  };
  const SettingsFormForTest = settingsModule.SettingsForm as (props: { userId: string; children?: React.ReactNode }) => React.ReactNode;

  const markup = renderToStaticMarkup(createElement(SettingsFormForTest, { userId: "user-id" }, createElement(ActionState)));

  expect(markup).toContain('id="settings-save-form"');
  expect(markup).toMatch(/<form[^>]*id="settings-save-form"[^>]*class="min-w-0 flex-1"/);
  expect(markup).toContain('aria-label="Save changes"');
  expect(markup).toContain('aria-label="Log out"');
  expect(markup).toContain("Enter a display name.");
  expect(markup).toMatch(/<form[^>]*id="settings-save-form"[^>]*>(?:(?!<\/form>)[\s\S])*name="profileName"/);
});
