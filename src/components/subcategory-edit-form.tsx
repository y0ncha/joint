"use client";

import { useState } from "react";

import { updateSubcategory } from "@/app/actions/categories";
import { CategoryColorPicker } from "@/components/category-form";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { selectSubcategoryPastelColor, subcategoryPastelColors } from "@/lib/shared-colors";
import { isCategoryIcon } from "@/lib/category-icons";

type ParentCategory = { id: string; name: string; color?: string; icon?: string; subcategoryColors: string[] };
type Subcategory = { id: string; category_id: string; name: string; color: string; icon?: string | null };

export function SubcategoryEditForm({ categories, subcategory }: { categories: ParentCategory[]; subcategory: Subcategory }) {
  const [categoryId, setCategoryId] = useState(subcategory.category_id);
  const parent = categories.find((category) => category.id === categoryId);
  const parentIcon = parent?.icon ?? null;
  const inheritedIcon = isCategoryIcon(parentIcon) ? parentIcon : "tag";
  const subcategoryIcon = subcategory.icon ?? null;
  const defaultIcon = isCategoryIcon(subcategoryIcon) ? subcategoryIcon : undefined;
  const colors = subcategoryPastelColors(parent?.color ?? "");
  const defaultColor =
    categoryId === subcategory.category_id
      ? subcategory.color
      : (selectSubcategoryPastelColor(parent?.color ?? "", parent?.subcategoryColors ?? []) ?? colors[0]);

  return (
    <form
      action={async (formData) => {
        await updateSubcategory(subcategory.id, formData);
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`subcategory-${subcategory.id}`}>Name</FieldLabel>
          <div className="flex overflow-hidden rounded-lg border border-input bg-white/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Input
              id={`subcategory-${subcategory.id}`}
              name="name"
              defaultValue={subcategory.name}
              required
              className="h-11 rounded-none border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0"
            />
            <CategoryIconPicker key={categoryId} defaultIcon={defaultIcon} inheritedIcon={inheritedIcon} />
          </div>
        </Field>
        {defaultColor ? <CategoryColorPicker key={categoryId} defaultColor={defaultColor} presetColors={colors} /> : null}
        <Field>
          <FieldLabel>Parent category</FieldLabel>
          <PillSelect
            ariaLabel="Parent category"
            name="categoryId"
            value={categoryId}
            onValueChange={setCategoryId}
            emptyLabel="Choose a category"
            options={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
          />
        </Field>
        <Button className="mt-5" type="submit">
          Save subcategory
        </Button>
      </FieldGroup>
    </form>
  );
}
