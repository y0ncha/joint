"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { nextPillOptionIndex } from "@/components/pill-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/lib/date-range";

type SpendingGranularity = "categories" | "subcategories";

export function DashboardSpendingCategorySelector({
  categories,
  month,
  range,
  selectedCategoryIds,
  granularity = "categories",
}: {
  categories: Array<{ id: string; name: string; color?: string }>;
  month: string;
  range?: DateRange;
  selectedCategoryIds: string[];
  granularity?: SpendingGranularity;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(-1);
  const visibleCategories = useMemo(
    () =>
      categories
        .filter((category) => category.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [categories, query],
  );
  const selectedCategories = categories.filter((category) => selectedCategoryIds.includes(category.id));

  function update(selectedIds: string[], nextGranularity = granularity) {
    const params = new URLSearchParams(searchParams);
    params.delete("spendingCategory");
    if (selectedIds.length) params.set("spendingCategories", selectedIds.join(","));
    else params.delete("spendingCategories");
    if (nextGranularity === "subcategories") params.set("spendingGranularity", nextGranularity);
    else params.delete("spendingGranularity");
    router.push(`${pathname}?${params}`);
  }

  function toggle(categoryId: string) {
    update(
      selectedCategoryIds.includes(categoryId)
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId],
    );
  }

  function moveActiveCategory(direction: -1 | 1) {
    setActiveCategoryIndex((currentIndex) => nextPillOptionIndex(currentIndex, visibleCategories.length, direction));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Configure spending breakdown">
          <Settings2 aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <LedgerMonthSelector month={month} range={range} />
        <Select value={granularity} onValueChange={(value) => value && update(selectedCategoryIds, value as SpendingGranularity)}>
          <SelectTrigger size="lg" className="w-full" aria-label="Spending granularity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="categories">Categories</SelectItem>
              <SelectItem value="subcategories">Subcategories</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Popover
          open={categoryOpen}
          onOpenChange={(nextOpen) => {
            setCategoryOpen(nextOpen);
            if (!nextOpen) {
              setQuery("");
              setActiveCategoryIndex(-1);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full justify-between gap-2 text-left"
              aria-label="Select spending categories"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setCategoryOpen(true);
                  moveActiveCategory(event.key === "ArrowDown" ? 1 : -1);
                }
              }}
            >
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selectedCategories.length ? (
                  <Badge variant="outline">Custom</Badge>
                ) : (
                  <span className="text-muted-foreground">All categories</span>
                )}
              </span>
              <ChevronDown data-icon="inline-end" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <Input
              aria-label="Search categories"
              aria-activedescendant={
                activeCategoryIndex === -1 ? undefined : `dashboard-spending-option-${visibleCategories[activeCategoryIndex]?.id}`
              }
              autoComplete="off"
              autoFocus
              name="category-search"
              placeholder="Search categories…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveCategoryIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActiveCategory(event.key === "ArrowDown" ? 1 : -1);
                } else if (event.key === "Enter" && activeCategoryIndex !== -1) {
                  event.preventDefault();
                  toggle(visibleCategories[activeCategoryIndex].id);
                }
              }}
            />
            <FieldSet className="mx-0.5 mb-2 max-h-56 overflow-y-auto">
              {visibleCategories.map((category) => (
                <Field
                  key={category.id}
                  id={`dashboard-spending-option-${category.id}`}
                  className={cn("rounded-md px-1", activeCategoryIndex === visibleCategories.indexOf(category) && "bg-muted")}
                  orientation="horizontal"
                >
                  <Checkbox
                    className="size-4"
                    id={`dashboard-spending-${category.id}`}
                    checked={selectedCategoryIds.includes(category.id)}
                    disabled={!selectedCategoryIds.includes(category.id) && selectedCategoryIds.length === 3}
                    onCheckedChange={() => toggle(category.id)}
                  />
                  <FieldLabel htmlFor={`dashboard-spending-${category.id}`}>
                    <Badge variant="outline" color={category.color} className="max-w-full truncate">
                      {category.name}
                    </Badge>
                  </FieldLabel>
                </Field>
              ))}
            </FieldSet>
          </PopoverContent>
        </Popover>
      </PopoverContent>
    </Popover>
  );
}
