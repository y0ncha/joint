"use client";

import { useState, useSyncExternalStore } from "react";
import { accentForeground, accentPresetColors, normalizeAccentColor } from "@/lib/accent";
import { ColorPicker } from "@/components/color-picker";

function readAccent() {
  return normalizeAccentColor(
    document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("joint-accent="))
      ?.split("=")[1],
  );
}

export function AccentPicker({ showLabel = true }: { showLabel?: boolean } = {}) {
  const browserAccent = useSyncExternalStore(
    () => () => {},
    readAccent,
    () => "#0f6b54",
  );
  const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
  const accent = selectedAccent ?? browserAccent;

  function selectAccent(value: string) {
    const nextAccent = normalizeAccentColor(value);
    setSelectedAccent(nextAccent);
    document.documentElement.style.setProperty("--primary", nextAccent);
    document.documentElement.style.setProperty("--primary-foreground", accentForeground(nextAccent));
    document.documentElement.style.setProperty("--ring", nextAccent);
    document.documentElement.style.setProperty("--chart-1", nextAccent);
    document.documentElement.style.setProperty("--accent", `color-mix(in srgb, ${nextAccent} 12%, white)`);
    document.documentElement.style.setProperty("--sidebar-primary", nextAccent);
    document.documentElement.style.setProperty("--sidebar-primary-foreground", accentForeground(nextAccent));
    document.documentElement.style.setProperty("--sidebar-ring", nextAccent);
  }

  return (
    <div className="flex flex-col gap-2">
      <input form="settings-save-form" type="hidden" name="accentColor" value={accent} />
      <input form="settings-save-form" type="hidden" name="initialAccentColor" value={browserAccent} />
      {showLabel ? (
        <p id="accent-color-label" className="text-sm text-muted-foreground">
          Accent
        </p>
      ) : null}
      <div aria-label="Accent color" aria-labelledby={showLabel ? "accent-color-label" : undefined}>
        <ColorPicker color={accent} onChange={selectAccent} presetColors={accentPresetColors} allowCustom={false} />
      </div>
    </div>
  );
}
