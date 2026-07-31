import { describe, expect, it } from "vitest";

import { hasUnsavedSettings } from "./settings-save-control";

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
