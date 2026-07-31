"use client";

import { deleteCategory, deleteSubcategory, updateCategory } from "@/app/actions/categories";
import { ChevronRight, FoldVertical, Trash2, UnfoldVertical } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategoryColorPicker, SubcategoryCreationSheet } from "@/components/category-form";
import { CategoryIcon, CategoryIconPicker } from "@/components/category-icon-picker";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PillSelect } from "@/components/pill-select";
import { SubcategoryEditForm } from "@/components/subcategory-edit-form";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isCategoryIcon } from "@/lib/category-icons";
import type { CSSProperties } from "react";

export type Category = {
  color: string;
  id: string;
  icon?: string;
  kind: "income" | "expense";
  name: string;
  transactionCount: number;
  archived_at: string | null;
  system_key?: string | null;
};

export type Subcategory = {
  color: string;
  id: string;
  icon?: string | null;
  category_id: string;
  name: string;
  transactionCount: number;
  archived_at: string | null;
  system_key?: string | null;
};

const sheetContentClassName =
  "inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg";

function SubcategoryEditor({
  categories,
  subcategories,
  subcategory,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  subcategory: Subcategory;
}) {
  const isProtected = subcategory.system_key !== null && subcategory.system_key !== undefined;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Manage ${subcategory.name} subcategory`}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-9"
        >
          <span className="truncate">{subcategory.name}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className={sheetContentClassName}>
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Edit subcategory</SheetTitle>
          <SheetDescription>Update this subcategory.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 pb-6">
          <SubcategoryEditForm
            subcategory={subcategory}
            categories={categories.map((parent) => ({
              id: parent.id,
              icon: parent.icon,
              name: parent.name,
              color: parent.color,
              subcategoryColors: subcategories
                .filter((child) => child.category_id === parent.id && child.id !== subcategory.id)
                .map((child) => child.color),
            }))}
          />
          {!isProtected ? <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete subcategory"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this subcategory?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the subcategory. Linked transactions become Uncategorized.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form
                    action={async () => {
                      await deleteSubcategory(subcategory.id);
                    }}
                  >
                    <AlertDialogAction type="submit" variant="destructive">
                      Delete subcategory
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SubcategoryList({
  categories,
  subcategories,
  allSubcategories,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  allSubcategories: Subcategory[];
}) {
  if (subcategories.length === 0) {
    return <p className="py-2 ps-6 text-sm text-muted-foreground">No subcategories yet</p>;
  }

  return (
    <ul className="flex flex-col gap-0">
      {subcategories.map((subcategory) => (
        <li
          key={subcategory.id}
          className="relative flex min-h-11 items-center justify-between gap-3 rounded-lg px-4 text-muted-foreground transition-colors duration-700 ease-in-out motion-reduce:transition-none hover:bg-foreground/5 hover:ring-2 hover:ring-foreground/5 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-[var(--subcategory-color)] md:min-h-9"
          style={{ "--subcategory-color": subcategory.color } as CSSProperties}
        >
          {subcategory.archived_at ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{subcategory.name}</span>
              <span className="text-sm text-muted-foreground">Archived</span>
            </div>
          ) : (
            <SubcategoryEditor categories={categories} subcategories={allSubcategories} subcategory={subcategory} />
          )}
        </li>
      ))}
    </ul>
  );
}

function CategoryEditor({
  category,
  categories,
}: {
  category: Category;
  categories: Array<{ id: string; name: string; color: string; icon?: string; subcategoryColors: string[] }>;
}) {
  const isProtected = category.system_key !== null && category.system_key !== undefined;
  const isGroceries = category.system_key === "groceries";
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Manage ${category.name} category`}
          className="flex min-h-11 w-full cursor-pointer items-center gap-4 px-3 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate px-1.5">{category.name}</span>
            <CategoryIcon name={category.icon} className="size-4 shrink-0" />
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className={sheetContentClassName}>
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Edit category</SheetTitle>
          <SheetDescription>Update this category.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 pb-6">
          <form
            action={async (input) => {
              await updateCategory(category.id, input);
            }}
          >
            <FieldGroup>
              {isProtected ? (
                <>
                  <input name="name" type="hidden" value={category.name} />
                  <input name="kind" type="hidden" value={category.kind} />
                  <Field>
                    <FieldLabel>Icon</FieldLabel>
                    <CategoryIconPicker defaultIcon={isCategoryIcon(category.icon ?? null) ? category.icon : "tag"} />
                  </Field>
                </>
              ) : <Field>
                <FieldLabel htmlFor={`category-name-${category.id}`}>Name</FieldLabel>
                <div className="flex overflow-hidden rounded-lg border border-input bg-white/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Input
                    id={`category-name-${category.id}`}
                    name="name"
                    defaultValue={category.name}
                    required
                    className="h-11 rounded-none border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0"
                  />
                  <CategoryIconPicker defaultIcon={isCategoryIcon(category.icon ?? null) ? category.icon : "tag"} />
                </div>
              </Field>}
              {!isProtected ? <Field>
                <FieldLabel>Type</FieldLabel>
                <PillSelect
                  ariaLabel="Category type"
                  name="kind"
                  defaultValue={category.kind}
                  options={[
                    { value: "income", label: "Income", className: "border-positive/20 bg-positive/10 text-positive" },
                    { value: "expense", label: "Expense", className: "border-negative/20 bg-negative/10 text-negative" },
                  ]}
                />
              </Field> : null}
              <CategoryColorPicker defaultColor={category.color} />
              <Button className="mt-5" type="submit">
                Save category
              </Button>
            </FieldGroup>
          </form>
          {!isGroceries ? <SubcategoryCreationSheet categories={categories} categoryId={category.id} /> : null}
          {!isProtected ? <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete category"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the category and its subcategories. Linked transactions become Uncategorized.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form
                    action={async () => {
                      await deleteCategory(category.id);
                    }}
                  >
                    <AlertDialogAction type="submit" variant="destructive">
                      Delete category
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CategorySection({
  categories,
  subcategories,
  emptyLabel,
  onCategoryOpenChange,
  onSectionOpenChange,
  openCategoryIds,
  title,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  emptyLabel: string;
  onCategoryOpenChange?: (categoryId: string, open: boolean) => void;
  onSectionOpenChange?: (categoryIds: string[], open: boolean) => void;
  openCategoryIds?: ReadonlySet<string>;
  title: string;
}) {
  const allExpanded = categories.length > 0 && categories.every((category) => openCategoryIds?.has(category.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {onSectionOpenChange && categories.length > 0 ? (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full text-foreground hover:bg-foreground/10 hover:text-foreground md:size-9"
              aria-label={`${allExpanded ? "Collapse" : "Expand"} ${title.toLowerCase()}`}
              onClick={() =>
                onSectionOpenChange(
                  categories.map((category) => category.id),
                  !allExpanded,
                )
              }
            >
              {allExpanded ? <FoldVertical aria-hidden="true" /> : <UnfoldVertical aria-hidden="true" />}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-7 pb-2">
        {categories.length === 0 ? (
          <p className="px-3 pb-2 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul aria-label={title} className="flex flex-col gap-1">
            {categories.map((category) => {
              const children = subcategories.filter((subcategory) => subcategory.category_id === category.id);
              return (
                <li key={category.id}>
                  <Collapsible
                    defaultOpen={openCategoryIds ? undefined : true}
                    onOpenChange={onCategoryOpenChange ? (open) => onCategoryOpenChange(category.id, open) : undefined}
                    open={openCategoryIds?.has(category.id)}
                    className="group/category flex flex-col gap-0"
                  >
                    <div
                      className="relative flex min-h-11 items-center rounded-lg transition-colors duration-700 ease-in-out motion-reduce:transition-none hover:bg-foreground/5 hover:ring-2 hover:ring-foreground/5 before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-[var(--category-color)]"
                      style={category.color ? ({ "--category-color": category.color } as CSSProperties) : undefined}
                    >
                      {category.archived_at ? (
                        <div className="flex min-h-11 flex-1 items-center gap-2 px-3 font-semibold">
                          <span className="truncate">{category.name}</span>
                          <CategoryIcon name={category.icon} className="size-4 shrink-0" />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <CategoryEditor
                            category={category}
                            categories={categories.map((parent) => ({
                              id: parent.id,
                              icon: parent.icon,
                              name: parent.name,
                              kind: parent.kind,
                              color: parent.color,
                              subcategoryColors: subcategories
                                .filter((child) => child.category_id === parent.id)
                                .map((child) => child.color),
                            }))}
                          />
                        </div>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="group/category-toggle size-11 shrink-0 rounded-none hover:bg-transparent aria-expanded:bg-transparent"
                          aria-label={`Toggle ${category.name} subcategories`}
                        >
                          <ChevronRight
                            data-icon="inline-end"
                            aria-hidden="true"
                            className="transition-transform motion-reduce:transition-none group-data-[state=open]/category-toggle:rotate-90"
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <SubcategoryList categories={categories} subcategories={children} allSubcategories={subcategories} />
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryList({
  categories,
  subcategories = [],
  onCategoryOpenChange,
  onSectionOpenChange,
  openCategoryIds,
}: {
  categories: Category[];
  subcategories?: Subcategory[];
  onCategoryOpenChange?: (categoryId: string, open: boolean) => void;
  onSectionOpenChange?: (categoryIds: string[], open: boolean) => void;
  openCategoryIds?: ReadonlySet<string>;
}) {
  return (
    <>
      <CategorySection
        categories={categories.filter(
          (category) => category.kind === "expense" && subcategories.some((subcategory) => subcategory.category_id === category.id),
        )}
        subcategories={subcategories}
        onCategoryOpenChange={onCategoryOpenChange}
        onSectionOpenChange={onSectionOpenChange}
        openCategoryIds={openCategoryIds}
        emptyLabel="No expense subcategories yet"
        title="Expense categories"
      />
      <CategorySection
        categories={categories.filter(
          (category) => category.kind === "income" && subcategories.some((subcategory) => subcategory.category_id === category.id),
        )}
        subcategories={subcategories}
        onCategoryOpenChange={onCategoryOpenChange}
        onSectionOpenChange={onSectionOpenChange}
        openCategoryIds={openCategoryIds}
        emptyLabel="No income subcategories yet"
        title="Income categories"
      />
    </>
  );
}
