"use client";

import { useState } from "react";

import { CategorySheet } from "@/components/category-form";
import { CategoryList, type Category, type Subcategory } from "@/components/category-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";

export function CategoriesWorkspace({
  categories,
  subcategories,
  defaultColor,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  defaultColor: string;
}) {
  const categoryIds = categories
    .filter((category) => subcategories.some((subcategory) => subcategory.category_id === category.id))
    .map((category) => category.id);
  const [openCategoryIds, setOpenCategoryIds] = useState(() => new Set(categoryIds));
  return (
    <WorkspaceShell
      title="Categories"
      description="Keep income and expense reporting clear."
      actions={
        <CategorySheet
          categories={categories
            .filter((category) => !category.archived_at)
            .map((category) => ({
              ...category,
              subcategoryColors: subcategories
                .filter((subcategory) => subcategory.category_id === category.id)
                .map((subcategory) => subcategory.color),
            }))}
          defaultColor={defaultColor}
        />
      }
    >
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList
          categories={categories}
          subcategories={subcategories}
          openCategoryIds={openCategoryIds}
          onSectionOpenChange={(categoryIds, open) => {
            setOpenCategoryIds((current) => {
              const next = new Set(current);
              categoryIds.forEach((categoryId) => (open ? next.add(categoryId) : next.delete(categoryId)));
              return next;
            });
          }}
          onCategoryOpenChange={(categoryId, open) => {
            setOpenCategoryIds((current) => {
              const next = new Set(current);
              if (open) next.add(categoryId);
              else next.delete(categoryId);
              return next;
            });
          }}
        />
      </div>
    </WorkspaceShell>
  );
}
