"use client";

import { useState, useTransition } from "react";

import { saveCurrentMemberColor } from "@/app/actions/profile";
import { ColorPicker } from "@/components/color-picker";

export function MemberColorSettingsControl({ color }: { color: string }) {
  const [selectedColor, setSelectedColor] = useState(color);
  const [, startTransition] = useTransition();

  function selectColor(value: string) {
    if (!value || selectedColor === value) return;
    startTransition(async () => {
      const result = await saveCurrentMemberColor(value);
      if (result.status === "error") return;
      setSelectedColor(value);
    });
  }

  return (
    <div aria-label="User color">
      <ColorPicker color={selectedColor} onChange={selectColor} recentColors={[selectedColor]} />
    </div>
  );
}
