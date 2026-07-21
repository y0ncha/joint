"use client";

import { useState, useSyncExternalStore } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  accentOptions,
  normalizeAccentName,
  serializeAccentCookie,
} from "@/lib/accent";

function readAccent() {
  return normalizeAccentName(document.documentElement.dataset.accent);
}

export function AccentPicker({ showLabel = true }: { showLabel?: boolean } = {}) {
  const browserAccent = useSyncExternalStore(() => () => {}, readAccent, () => "mint");
  const [selectedAccent, setSelectedAccent] = useState<ReturnType<typeof normalizeAccentName> | null>(null);
  const accent = selectedAccent ?? browserAccent;

  function selectAccent(value: string) {
    const nextAccent = normalizeAccentName(value);
    setSelectedAccent(nextAccent);
    document.documentElement.dataset.accent = nextAccent;
    document.cookie = serializeAccentCookie(nextAccent, window.location.protocol === "https:");
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
