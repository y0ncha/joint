"use client";

import { useEffect, useSyncExternalStore } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ACCENT_STORAGE_KEY,
  accentOptions,
  normalizeAccentName,
} from "@/lib/accent";

const accentChangeEvent = "joint-accent-change";

function readAccent() {
  return normalizeAccentName(window.localStorage.getItem(ACCENT_STORAGE_KEY));
}

function subscribeToAccent(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(accentChangeEvent, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(accentChangeEvent, callback);
  };
}

export function AccentPicker({ showLabel = true }: { showLabel?: boolean } = {}) {
  const accent = useSyncExternalStore(subscribeToAccent, readAccent, () => "mint");

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  function selectAccent(value: string) {
    const nextAccent = normalizeAccentName(value);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
    window.dispatchEvent(new Event(accentChangeEvent));
  }

  return (
    <div className="flex flex-col gap-2">
      {showLabel ? <p className="text-sm text-muted-foreground">Accent</p> : null}
      <ToggleGroup
        type="single"
        value={accent}
        onValueChange={selectAccent}
        aria-label="Accent color"
        className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {accentOptions.map((option) => (
          <ToggleGroupItem
            key={option.name}
            value={option.name}
            aria-label={`${option.label}: ${option.description}`}
            className="h-auto min-h-11 flex-col gap-1.5 rounded-xl bg-transparent px-2 py-2 text-xs hover:bg-white/35 data-[state=on]:bg-transparent"
            title={option.label}
          >
            <span aria-hidden="true" className="size-5 rounded-full border border-black/10" style={{ backgroundColor: option.swatch }} />
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
