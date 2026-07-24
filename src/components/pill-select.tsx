"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PillOption = { value: string; label: string; color?: string };

export function PillSelect({ ariaLabel, defaultValue, disabled, emptyLabel = "Choose a value", name, onValueChange, options, preserveOrder = false, value }: { ariaLabel: string; defaultValue?: string; disabled?: boolean; emptyLabel?: string; name?: string; onValueChange?: (value: string) => void; options: PillOption[]; preserveOrder?: boolean; value?: string }) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const visibleOptions = useMemo(() => (preserveOrder ? options : [...options].sort((left, right) => left.label.localeCompare(right.label))).filter((option) => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [options, preserveOrder, query]);

  function select(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="h-11 w-full justify-start rounded-xl" aria-label={ariaLabel} onKeyDown={(event) => { if (event.key.length === 1) { setQuery(event.key); setOpen(true); } }}>
          {selected ? <Badge variant="outline" color={selected.color} className="max-w-full truncate">{selected.label}</Badge> : <span className="text-muted-foreground">{emptyLabel}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
        <Input autoFocus aria-label={`Search ${ariaLabel.toLowerCase()}`} placeholder={`Search ${ariaLabel.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {visibleOptions.map((option) => (
            <Button key={option.value} type="button" variant="ghost" className="h-11 justify-start" onClick={() => select(option.value)}>
              <Badge variant="outline" color={option.color} className="max-w-full truncate">{option.label}</Badge>
            </Button>
          ))}
          {visibleOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No matching options.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
