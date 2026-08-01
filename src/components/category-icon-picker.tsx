"use client";

import { createElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { categoryIcon, categoryIcons, isCategoryIcon, type CategoryIconName } from "@/lib/category-icons";

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const props = { "data-category-icon": name ?? "tag", "aria-hidden": true, className };
  return createElement(categoryIcon(name), props);
}

export function CategoryIconPicker({ defaultIcon = "tag", inheritedIcon }: { defaultIcon?: string; inheritedIcon?: string }) {
  const initialDefaultIcon = isCategoryIcon(defaultIcon) ? defaultIcon : "tag";
  const initialInheritedIcon = isCategoryIcon(inheritedIcon ?? null) ? inheritedIcon : undefined;
  const [overrideIcon, setOverrideIcon] = useState<CategoryIconName | "">(
    initialInheritedIcon ? (defaultIcon === "tag" ? "" : initialDefaultIcon) : initialDefaultIcon,
  );
  const icon = overrideIcon || initialInheritedIcon || "tag";

  return (
    <>
      <input name="icon" type="hidden" value={overrideIcon} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-none border-0 border-l border-input bg-transparent"
            aria-label="Choose icon"
          >
            {createElement(categoryIcon(icon), { "aria-hidden": true })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" aria-label="Category icon">
          <div className="grid grid-cols-6 gap-1">
            {categoryIcons.map(([name, label, OptionIcon]) => (
              <Button
                key={name}
                type="button"
                variant="ghost"
                size="icon"
                className={icon === name ? "size-11 bg-primary/10 text-primary" : "size-11"}
                aria-label={label}
                aria-pressed={icon === name}
                onClick={() => setOverrideIcon(name)}
              >
                <OptionIcon aria-hidden="true" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
