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
  });
});
