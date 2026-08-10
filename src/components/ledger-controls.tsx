"use client";

import { ChevronDown, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { readLedgerFilterState, type LedgerFilterKind, type LedgerSort } from "@/lib/ledger-filters";

export type { LedgerFilterKind, LedgerSort } from "@/lib/ledger-filters";

const typeOptions = [
  { value: "income", label: "Income", className: "border-positive/20 bg-positive/10 text-positive" },
  { value: "expense", label: "Expenses", className: "border-negative/20 bg-negative/10 text-negative" },
] as const;

export function getNextLedgerFilterKind(filterKind: LedgerFilterKind, type: "income" | "expense"): LedgerFilterKind {
  const selected = filterKind === "all" ? ["income", "expense"] : [filterKind];
  const next = selected.includes(type)
    ? selected.length === 1
      ? selected
      : selected.filter((value) => value !== type)
    : [...selected, type];
  return next.length === 2 ? "all" : (next[0] as LedgerFilterKind);
}

export function LedgerControls({
  categories,
  categoryIds,
  filterKind,
  importRequested,
  members,
  month,
  paidByIds,
  sort,
}: {
  categories: Array<{ id: string; name: string; color: string }>;
  categoryIds: string[];
  filterKind: LedgerFilterKind;
  importRequested: boolean;
  members: Array<{ id: string; label: string; color?: string }>;
  month: string;
  paidByIds: string[];
  sort: LedgerSort;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const activeState = readLedgerFilterState(searchParams, { categoryIds, filterKind, paidByIds, sort });
  const { categoryIds: activeCategoryIds, filterKind: activeFilterKind, paidByIds: activePaidByIds, sort: activeSort } = activeState;
  const visibleCategories = useMemo(
    () =>
      categories
        .filter((category) => category.name.toLocaleLowerCase().includes(categoryQuery.toLocaleLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [categories, categoryQuery],
  );
  const selectedCategories = categories.filter((category) => activeCategoryIds.includes(category.id));
  const allCategoriesSelected =
    activeCategoryIds.length === 0 || (activeCategoryIds.length === categories.length + 1 && activeCategoryIds.includes("uncategorized"));
  const selectedPayers = members.filter((member) => activePaidByIds.includes(member.id));
  const allPayersSelected = activePaidByIds.length === members.length + 1 && activePaidByIds.includes("unassigned");

  function update(next: Partial<{ categoryIds: string[]; filterKind: LedgerFilterKind; paidByIds: string[]; sort: LedgerSort }>) {
    const params = new URLSearchParams(searchParams);
    const nextFilterKind = next.filterKind ?? activeFilterKind;
    const nextSort = next.sort ?? activeSort;
    const nextCategoryIds = next.categoryIds ?? activeCategoryIds;
    const nextPaidByIds = next.paidByIds ?? activePaidByIds;
    if (!params.has("from")) params.set("month", month);
    if (importRequested) params.set("import", "1");
    if (nextFilterKind !== "all") params.set("filter", nextFilterKind);
    else params.delete("filter");
    if (nextSort !== "date-desc") params.set("sort", nextSort);
    else params.delete("sort");
    if (nextCategoryIds.length) params.set("categories", nextCategoryIds.join(","));
    else params.delete("categories");
    if (nextPaidByIds.length) params.set("paidBy", nextPaidByIds.join(","));
    else params.delete("paidBy");
    router.push(`${pathname}?${params}`);
  }

  function toggle(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-11" aria-label="Ledger controls">
          <Settings2 aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Ledger controls</SheetTitle>
          <SheetDescription>Filter or sort transactions.</SheetDescription>
        </SheetHeader>
        <FieldGroup className="px-6 pb-6">
          <Field>
            <FieldLabel id="ledger-type-label">Type</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 h-auto w-full justify-between gap-2 rounded-xl py-2 text-left"
                  aria-label="Filter transaction types"
                  aria-labelledby="ledger-type-label"
                >
                  {activeFilterKind === "all" ? (
                    <span className="text-muted-foreground">All transactions</span>
                  ) : (
                    (() => {
                      const option = typeOptions.find((item) => item.value === filterKind);
                      return option ? (
                        <Badge variant="outline" className={option.className}>
                          {option.label}
                        </Badge>
                      ) : null;
                    })()
                  )}
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                <FieldSet className="mx-0.5 mb-2">
                  <FieldLegend className="sr-only">Transaction type options</FieldLegend>
                  {typeOptions.map((option) => (
                    <Field key={option.value} orientation="horizontal">
                      <Checkbox
                        className="size-4"
                        id={`ledger-type-${option.value}`}
                        checked={activeFilterKind === "all" || activeFilterKind === option.value}
                        onCheckedChange={() => update({ filterKind: getNextLedgerFilterKind(activeFilterKind, option.value) })}
                      />
                      <FieldLabel htmlFor={`ledger-type-${option.value}`}>
                        <Badge variant="outline" className={option.className}>
                          {option.label}
                        </Badge>
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldSet>
              </PopoverContent>
            </Popover>
          </Field>
          <Field>
            <FieldLabel id="ledger-category-label">Category</FieldLabel>
            <Popover
              open={categoryOpen}
              onOpenChange={(open) => {
                setCategoryOpen(open);
                if (!open) setCategoryQuery("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 h-auto w-full justify-between gap-2 rounded-xl py-2 text-left"
                  aria-label="Filter categories"
                  aria-labelledby="ledger-category-label"
                  onKeyDown={(event) => {
                    if (event.key.length === 1) {
                      setCategoryQuery(event.key);
                      setCategoryOpen(true);
                    }
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {allCategoriesSelected ? (
                      <span className="text-muted-foreground">All categories</span>
                    ) : (
                      <>
                        {selectedCategories.map((category) => (
                          <Badge key={category.id} variant="outline" color={category.color} className="max-w-full truncate">
                            {category.name}
                          </Badge>
                        ))}
                        {activeCategoryIds.includes("uncategorized") ? (
                          <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
                            Uncategorized
                          </Badge>
                        ) : null}
                      </>
                    )}
                  </span>
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                <Input
                  aria-label="Search categories"
                  autoComplete="off"
                  name="category-search"
                  placeholder="Search categories…"
                  value={categoryQuery}
                  onChange={(event) => setCategoryQuery(event.target.value)}
                />
                <FieldSet className="mx-0.5 mb-2 max-h-56 overflow-y-auto">
                  <FieldLegend className="sr-only">Category options</FieldLegend>
                  {visibleCategories.map((category) => (
                    <Field key={category.id} orientation="horizontal">
                      <Checkbox
                        className="size-4"
                        id={`ledger-category-${category.id}`}
                        checked={activeCategoryIds.includes(category.id)}
                        onCheckedChange={() => update({ categoryIds: toggle(activeCategoryIds, category.id) })}
                      />
                      <FieldLabel htmlFor={`ledger-category-${category.id}`}>
                        <Badge variant="outline" color={category.color} className="max-w-full truncate">
                          {category.name}
                        </Badge>
                      </FieldLabel>
                    </Field>
                  ))}
                  <Field orientation="horizontal">
                    <Checkbox
                      className="size-4"
                      id="ledger-category-uncategorized"
                      checked={activeCategoryIds.includes("uncategorized")}
                      onCheckedChange={() => update({ categoryIds: toggle(activeCategoryIds, "uncategorized") })}
                    />
                    <FieldLabel htmlFor="ledger-category-uncategorized">
                      <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
                        Uncategorized
                      </Badge>
                    </FieldLabel>
                  </Field>
                  {visibleCategories.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">No matching categories.</p>
                  ) : null}
                </FieldSet>
              </PopoverContent>
            </Popover>
          </Field>
          <Field>
            <FieldLabel id="ledger-payer-label">Paid by</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 h-auto w-full justify-between gap-2 rounded-xl py-2 text-left"
                  aria-label="Filter payers"
                  aria-labelledby="ledger-payer-label"
                >
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {activePaidByIds.length === 0 || allPayersSelected ? (
                      <span className="text-muted-foreground">All payers</span>
                    ) : (
                      <>
                        {selectedPayers.map((member) => (
                          <Badge key={member.id} variant="outline" color={member.color} className="max-w-full truncate">
                            {member.label}
                          </Badge>
                        ))}
                        {activePaidByIds.includes("unassigned") ? (
                          <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
                            Unassigned
                          </Badge>
                        ) : null}
                      </>
                    )}
                  </span>
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                <FieldSet className="mx-0.5 mb-2">
                  <FieldLegend className="sr-only">Payer options</FieldLegend>
                  {members.map((member) => (
                    <Field key={member.id} orientation="horizontal">
                      <Checkbox
                        className="size-4"
                        id={`ledger-member-${member.id}`}
                        checked={activePaidByIds.includes(member.id)}
                        onCheckedChange={() => update({ paidByIds: toggle(activePaidByIds, member.id) })}
                      />
                      <FieldLabel htmlFor={`ledger-member-${member.id}`}>
                        <Badge variant="outline" color={member.color} className="max-w-full truncate">
                          {member.label}
                        </Badge>
                      </FieldLabel>
                    </Field>
                  ))}
                  <Field orientation="horizontal">
                    <Checkbox
                      className="size-4"
                      id="ledger-member-unassigned"
                      checked={activePaidByIds.includes("unassigned")}
                      onCheckedChange={() => update({ paidByIds: toggle(activePaidByIds, "unassigned") })}
                    />
                    <FieldLabel htmlFor="ledger-member-unassigned">
                      <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
                        Unassigned
                      </Badge>
                    </FieldLabel>
                  </Field>
                </FieldSet>
              </PopoverContent>
            </Popover>
          </Field>
          <Field>
            <FieldLabel htmlFor="ledger-sort">Sort by</FieldLabel>
            <Select value={activeSort} onValueChange={(value) => update({ sort: value as LedgerSort })}>
              <SelectTrigger id="ledger-sort" aria-label="Sort by" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="date-desc">Newest first</SelectItem>
                  <SelectItem value="date-asc">Oldest first</SelectItem>
                  <SelectItem value="amount-desc">Highest amount</SelectItem>
                  <SelectItem value="amount-asc">Lowest amount</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button type="button" onClick={() => update({ categoryIds: [], filterKind: "all", paidByIds: [], sort: "date-desc" })}>
            Reset filters
          </Button>
        </FieldGroup>
      </SheetContent>
    </Sheet>
  );
}
