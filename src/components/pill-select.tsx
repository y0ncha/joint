"use client";

import { useMemo, useState, type ComponentType, type Ref, type SVGProps } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type PillOption = {
  value: string;
  label: string;
  description?: string;
  color?: string;
  className?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  section?: { id: string; label: string };
};

type PillSelectProps = {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  ariaLabel: string;
  defaultValue?: string;
  disabled?: boolean;
  emptyLabel?: string;
  grouped?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  options: PillOption[];
  popoverContainer?: HTMLElement | null;
  preserveOrder?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  value?: string;
};

export function PillSelect({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel,
  defaultValue,
  disabled,
  emptyLabel = "Choose a value",
  grouped = false,
  name,
  onValueChange,
  options,
  popoverContainer,
  preserveOrder = false,
  triggerRef,
  value,
}: PillSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const SelectedIcon = selected?.icon;
  const visibleOptions = useMemo(
    () =>
      (preserveOrder ? options : [...options].sort((left, right) => left.label.localeCompare(right.label))).filter((option) =>
        option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [options, preserveOrder, query],
  );
  const unsectionedOptions = visibleOptions.filter((option) => !option.section);
  const sections = new Map<string, { label: string; options: PillOption[] }>();
  for (const option of visibleOptions) {
    if (!option.section) continue;
    const section = sections.get(option.section.id) ?? { label: option.section.label, options: [] };
    section.options.push(option);
    sections.set(option.section.id, section);
  }

  function select(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    setQuery("");
  }

  function renderOption(option: PillOption) {
    return (
      <Button
        key={option.value}
        type="button"
        variant="ghost"
        className={cn("h-11 justify-start", option.description && "h-auto min-h-11 py-2")}
        onClick={() => select(option.value)}
      >
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <Badge
            variant="outline"
            color={option.color}
            className={cn(
              "max-w-full truncate",
              !option.color && !option.className && "border-muted-foreground/20 bg-muted text-muted-foreground",
              option.className,
            )}
          >
            {option.icon ? <option.icon aria-hidden="true" className="size-3 shrink-0" /> : null}
            {option.label}
          </Badge>
          {option.description ? <span className="text-left text-xs text-muted-foreground">{option.description}</span> : null}
        </span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-11 w-full justify-start rounded-xl"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          onKeyDown={(event) => {
            if (event.key.length === 1) {
              setQuery(event.key);
              setOpen(true);
            }
          }}
        >
          {selected ? (
            <Badge
              variant="outline"
              color={selected.color}
              className={cn(
                "max-w-full truncate",
                !selected.color && !selected.className && "border-muted-foreground/20 bg-muted text-muted-foreground",
                selected.className,
              )}
            >
              {SelectedIcon ? <SelectedIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
              {selected.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{emptyLabel}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent container={popoverContainer} align="start" className="w-(--radix-popover-trigger-width) p-2">
        <Input
          autoFocus
          autoComplete="off"
          aria-label={`Search ${ariaLabel.toLowerCase()}`}
          name={`${ariaLabel.toLowerCase().replaceAll(" ", "-")}-search`}
          placeholder={`Search ${ariaLabel.toLowerCase()}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {grouped ? (
            <>
              {unsectionedOptions.map(renderOption)}
              {[...sections].map(([sectionId, section]) => {
                const headingId = `pill-select-section-${sectionId}`;

                return (
                  <div key={sectionId} className="flex flex-col gap-1">
                    <Separator className="my-1" />
                    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1">
                      <h3 id={headingId} className="px-2 text-xs font-medium text-muted-foreground">
                        {section.label}
                      </h3>
                      {section.options.map(renderOption)}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            visibleOptions.map(renderOption)
          )}
          {visibleOptions.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No matching options.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
