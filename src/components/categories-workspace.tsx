"use client";

import { ChevronsDown, ChevronsUp } from "lucide-react";
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
  const allExpanded = categoryIds.length > 0 && categoryIds.every((categoryId) => openCategoryIds.has(categoryId));

  return (
    <WorkspaceShell
      title="Categories"
      description="Keep income and expense reporting clear."
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-full text-primary hover:bg-primary/10 hover:text-primary"
            aria-label={allExpanded ? "Collapse all categories" : "Expand all categories"}
            disabled={categoryIds.length === 0}
            onClick={() => setOpenCategoryIds(new Set(allExpanded ? [] : categoryIds))}
          >
            {allExpanded ? <ChevronsUp aria-hidden="true" /> : <ChevronsDown aria-hidden="true" />}
          </Button>
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
        </>
      }
    >
      <div className="mt-6 flex flex-col gap-4">
        <CategoryList
          categories={categories}
          subcategories={subcategories}
          openCategoryIds={openCategoryIds}
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
