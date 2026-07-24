"use client";

import { useState } from "react";
import { BlockPicker, CirclePicker } from "react-color";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isHexColor, isSharedPastelColor, sharedPastelColors } from "@/lib/shared-colors";

export function ColorPicker({ color, onChange, presetColors = sharedPastelColors.map(({ value }) => value), recentColors = [] }: { color: string; onChange: (color: string) => void; presetColors?: string[]; recentColors?: string[] }) {
  const [open, setOpen] = useState(false);
  const [pickedColors, setPickedColors] = useState<string[]>([]);
  const [previewColor, setPreviewColor] = useState(color);
  const blockColors = [...new Set([color, ...pickedColors, ...recentColors].filter((value): value is string => isHexColor(value) && !isSharedPastelColor(value)))].slice(0, 5);

  function selectCustomColor(value: string) {
    setPickedColors((current) => [value, ...current.filter((color) => color !== value)]);
    onChange(value);
  }

  return (
    <div className="color-picker flex w-full flex-wrap items-center justify-between" style={{ "--selected-color": color } as React.CSSProperties}>
      <CirclePicker color={color} colors={presetColors} onChangeComplete={(next) => onChange(next.hex)} circleSize={24} circleSpacing={0} styles={{ default: { card: { display: "contents" } } } as never} />
      <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setPreviewColor(color); }}>
        <div className="relative size-7">
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="absolute -inset-1.5 size-10 rounded-full border-0 bg-transparent" aria-label="Custom color">
              <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-border"><Plus aria-hidden="true" /></span>
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-3" align="end">
          <BlockPicker color={previewColor} colors={blockColors} onChange={(next) => setPreviewColor(next.hex)} triangle="hide" styles={{ default: { card: { width: "100%", background: "transparent", boxShadow: "none", borderRadius: 0 }, input: { marginTop: "8px" } } } as never} />
          <Button type="button" variant="outline" className="mx-2.5 -mt-2 w-40 bg-white hover:bg-white/80" onClick={() => { selectCustomColor(previewColor); setOpen(false); }}>Select</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
