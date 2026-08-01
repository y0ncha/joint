"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createCategory, createSubcategory } from "@/app/actions/categories";
import type { ActionResult } from "@/app/actions/result";
import { ColorPicker } from "@/components/color-picker";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isCategoryIcon } from "@/lib/category-icons";
import { categoryPastelColors, selectSubcategoryPastelColor, subcategoryPastelColors } from "@/lib/shared-colors";

export function CategoryColorPicker({
  defaultColor = categoryPastelColors[0],
  presetColors = categoryPastelColors,
}: {
  defaultColor?: string;
  presetColors?: readonly string[];
}) {
  const [color, setColor] = useState(defaultColor);

  return (
    <Field>
      <FieldLabel id="category-color-label">Color</FieldLabel>
      <input name="color" type="hidden" value={color} />
      <div aria-labelledby="category-color-label">
        <ColorPicker color={color} onChange={setColor} presetColors={[...presetColors]} allowCustom={false} />
      </div>
    </Field>
  );
}

type CategoryKind = "income" | "expense";
type CategoryOption = {
  id: string;
  name: string;
  kind?: CategoryKind;
  color: string;
  icon?: string;
  system_key?: string | null;
  subcategoryColors?: string[];
};

export function CategoryCreationPreview({
  categories = [],
  defaultColor = "#dcece3",
  initialCategoryId = "",
  initialMode = "category",
  modeLocked = false,
}: {
  categories?: CategoryOption[];
  defaultColor?: string;
  initialCategoryId?: string;
  initialMode?: "category" | "subcategory";
  modeLocked?: boolean;
}) {
  const [mode, setMode] = useState<"category" | "subcategory">(initialMode);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [kind, setKind] = useState<CategoryKind | "">(() => categories.find((category) => category.id === initialCategoryId)?.kind ?? "");
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const filteredCategories = (kind ? categories.filter((category) => category.kind === kind) : categories).filter(
    (category) => category.system_key !== "groceries",
  );
  const selectedIcon = selectedCategory?.icon ?? null;
  const selectedCategoryIcon = isCategoryIcon(selectedIcon) ? selectedIcon : "tag";
  const childColors = selectedCategory ? subcategoryPastelColors(selectedCategory.color) : [];
  const defaultSubcategoryColor = selectedCategory
    ? (selectSubcategoryPastelColor(selectedCategory.color, selectedCategory.subcategoryColors ?? []) ?? childColors[0])
    : undefined;
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => {
    if (mode === "category") return createCategory(formData);
    if (!categoryId) return { status: "error", formError: "Choose a category.", fieldErrors: {} };
    return createSubcategory(categoryId, formData);
  }, null);

  return (
    <form action={formAction}>
      <FieldGroup>
        {!modeLocked ? (
          <Field>
            <FieldLabel htmlFor="create-mode">Create</FieldLabel>
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger id="create-mode" className="w-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="subcategory">Subcategory</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {mode === "category" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <div className="flex overflow-hidden rounded-lg border border-input bg-white/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  id="category-name"
                  name="name"
                  required
                  autoComplete="off"
                  className="h-11 rounded-none border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0"
                />
                <CategoryIconPicker />
              </div>
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <PillSelect
                ariaLabel="Type"
                name="kind"
                defaultValue="expense"
                options={[
                  { value: "income", label: "Income", className: "border-positive/20 bg-positive/10 text-positive" },
                  { value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" },
                ]}
              />
            </Field>
            <CategoryColorPicker defaultColor={defaultColor} />
            <Button className="mt-[30px]" disabled={isPending} type="submit">
              Add category
            </Button>
          </FieldGroup>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <PillSelect
                ariaLabel="Type"
                value={kind}
                onValueChange={(value) => {
                  setKind(value as CategoryKind);
                  if (selectedCategory?.kind && selectedCategory.kind !== value) setCategoryId("");
                }}
                options={[
                  { value: "income", label: "Income", className: "border-positive/20 bg-positive/10 text-positive" },
                  { value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" },
                ]}
              />
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <PillSelect
                ariaLabel="Category"
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  setKind(categories.find((category) => category.id === value)?.kind ?? kind);
                }}
                emptyLabel="Choose a category"
                options={filteredCategories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subcategory-name">Name</FieldLabel>
              <div className="flex overflow-hidden rounded-lg border border-input bg-white/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  id="subcategory-name"
                  name="name"
                  required
                  autoComplete="off"
                  className="h-11 rounded-none border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0"
                />
                <CategoryIconPicker inheritedIcon={selectedCategoryIcon} />
              </div>
            </Field>
            {defaultSubcategoryColor ? (
              <CategoryColorPicker key={categoryId} defaultColor={defaultSubcategoryColor} presetColors={childColors} />
            ) : null}
            <Button className="mt-[30px]" disabled={isPending || !categoryId} type="submit">
              Add subcategory
            </Button>
          </FieldGroup>
        )}
        {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
      </FieldGroup>
    </form>
  );
}

export function SubcategoryCreationSheet({ categories, categoryId }: { categories: CategoryOption[]; categoryId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline">
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add subcategory
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add subcategory</SheetTitle>
          <SheetDescription>Create a subcategory for this category.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <CategoryCreationPreview categories={categories} initialCategoryId={categoryId} initialMode="subcategory" modeLocked />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CategorySheet({ categories = [], defaultColor = "#dcece3" }: { categories?: CategoryOption[]; defaultColor?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary" aria-label="Add category">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm">
            <Plus aria-hidden="true" />
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add category</SheetTitle>
          <SheetDescription>Create a category or subcategory.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <CategoryCreationPreview categories={categories} defaultColor={defaultColor} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
