"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { updateSubcategory } from "@/app/actions/categories";
import type { ActionResult } from "@/app/actions/result";
import { CategoryColorPicker } from "@/components/category-form";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { selectSubcategoryPastelColor, subcategoryPastelColors } from "@/lib/shared-colors";
import { isCategoryIcon } from "@/lib/category-icons";

type ParentCategory = { id: string; name: string; color?: string; icon?: string; system_key?: string | null; subcategoryColors: string[] };
type Subcategory = { id: string; category_id: string; name: string; color: string; icon?: string | null; system_key?: string | null };

export function SubcategoryEditForm({ categories, subcategory }: { categories: ParentCategory[]; subcategory: Subcategory }) {
  const isProtected = subcategory.system_key !== null && subcategory.system_key !== undefined;
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
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_state, input) => updateSubcategory(subcategory.id, input),
    null,
  );
  useEffect(() => {
    if (state?.status === "success") toast.success("Saved", { id: "subcategory-save" });
    if (state?.status === "error") toast.error(state.formError, { id: "subcategory-save" });
  }, [state]);

  return (
    <form action={formAction}>
      <FieldGroup>
        {isProtected ? (
          <>
            <input name="name" type="hidden" value={subcategory.name} />
            <input name="categoryId" type="hidden" value={subcategory.category_id} />
            <Field>
              <FieldLabel>Icon</FieldLabel>
              <CategoryIconPicker defaultIcon={defaultIcon} inheritedIcon={inheritedIcon} />
            </Field>
          </>
        ) : (
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
        )}
        {defaultColor ? <CategoryColorPicker key={categoryId} defaultColor={defaultColor} presetColors={colors} /> : null}
        {!isProtected ? (
          <Field>
            <FieldLabel>Parent category</FieldLabel>
            <PillSelect
              ariaLabel="Parent category"
              name="categoryId"
              value={categoryId}
              onValueChange={setCategoryId}
              emptyLabel="Choose a category"
              options={categories
                .filter((category) => category.system_key !== "groceries")
                .map((category) => ({ value: category.id, label: category.name, color: category.color }))}
            />
          </Field>
        ) : null}
        <Button className="mt-5" disabled={isPending} type="submit">
          Save subcategory
        </Button>
      </FieldGroup>
    </form>
  );
}
