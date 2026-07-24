"use client";

import { useState, useSyncExternalStore } from "react";
import {
  accentForeground,
  accentPresetColors,
  normalizeAccentColor,
  serializeAccentCookie,
} from "@/lib/accent";
import { ColorPicker } from "@/components/color-picker";

const ACCENT_RECENT_COLORS_KEY = "joint-accent-recent-colors";
let recentColorsRaw: string | null = null;
let recentColorsSnapshot: string[] = [];

function readAccent() {
  return normalizeAccentColor(document.cookie.split("; ").find((cookie) => cookie.startsWith("joint-accent="))?.split("=")[1]);
}

function readRecentColors() {
  const rawColors = localStorage.getItem(ACCENT_RECENT_COLORS_KEY);
  if (rawColors === recentColorsRaw) return recentColorsSnapshot;

  recentColorsRaw = rawColors;
  try {
    const colors = JSON.parse(rawColors ?? "[]");
    recentColorsSnapshot = Array.isArray(colors) ? colors.filter((color): color is string => /^#[0-9A-Fa-f]{6}$/.test(color)) : [];
  } catch {
    recentColorsSnapshot = [];
  }

  return recentColorsSnapshot;
}

export function AccentPicker({ showLabel = true }: { showLabel?: boolean } = {}) {
  const browserAccent = useSyncExternalStore(() => () => {}, readAccent, () => "#0f6b54");
  const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
  const storedRecentColors = useSyncExternalStore(() => () => {}, readRecentColors, () => recentColorsSnapshot);
  const [recentColors, setRecentColors] = useState<string[]>([]);
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
    document.cookie = serializeAccentCookie(nextAccent, window.location.protocol === "https:");
    setRecentColors((current) => {
      const nextColors = [nextAccent, ...current, ...storedRecentColors.filter((color) => color !== nextAccent)];
      localStorage.setItem(ACCENT_RECENT_COLORS_KEY, JSON.stringify(nextColors));
      return nextColors;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {showLabel ? <p id="accent-color-label" className="text-sm text-muted-foreground">Accent</p> : null}
      <div aria-label="Accent color" aria-labelledby={showLabel ? "accent-color-label" : undefined}><ColorPicker color={accent} onChange={selectAccent} presetColors={accentPresetColors} recentColors={[...recentColors, ...storedRecentColors]} /></div>
    </div>
  );
}
