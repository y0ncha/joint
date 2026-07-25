"use client";

import { useState } from "react";

import { ColorPicker } from "@/components/color-picker";

export function MemberColorSettingsControl({ color }: { color: string }) {
  const [selectedColor, setSelectedColor] = useState(color);

  function selectColor(value: string) {
    if (value) setSelectedColor(value);
  }

  return (
    <div aria-label="User color">
      <input form="settings-save-form" type="hidden" name="color" value={selectedColor} />
      <input form="settings-save-form" type="hidden" name="initialColor" value={color} />
      <ColorPicker color={selectedColor} onChange={selectColor} allowCustom={false} />
    </div>
  );
}
