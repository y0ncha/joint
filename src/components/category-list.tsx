import { archiveCategory, updateCategory } from "@/app/actions/categories";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Category = { id: string; name: string; kind: "income" | "expense"; archived_at: string | null };

function CategoryKindBadge({ category }: { category: Category }) {
  const label = category.archived_at ? "Archived" : category.kind === "income" ? "Income" : "Expense";
  const Icon = category.kind === "income" ? ArrowDownRight : ArrowUpRight;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-1 text-xs",
        category.archived_at
          ? "border-border text-muted-foreground"
          : category.kind === "income"
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-negative/20 bg-negative/10 text-negative",
      )}
    >
      {category.archived_at ? null : <Icon aria-hidden="true" data-icon="inline-start" />}
      {label}
    </Badge>
  );
}

function CategorySection({
  categories,
  description,
  emptyLabel,
  title,
}: {
  categories: Category[];
  description: string;
  emptyLabel: string;
  title: string;
}) {
  return (
    <Card className="border-white/50 bg-card/90">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {categories.map((category) => (
              <li key={category.id}>
                {category.archived_at ? (
                  <div className="flex min-h-14 items-center justify-between gap-4 py-4">
                    <p className="min-w-0 truncate font-medium">{category.name}</p>
                    <CategoryKindBadge category={category} />
                  </div>
                ) : (
                  <Sheet>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 truncate font-medium">{category.name}</span>
                        <CategoryKindBadge category={category} />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg">
                      <SheetHeader className="p-6">
                        <SheetTitle className="text-xl">Edit category</SheetTitle>
                        <SheetDescription>Rename this category, change its type, or delete it from new entries.</SheetDescription>
                      </SheetHeader>
                      <div className="flex flex-col gap-4 px-6 pb-6">
                        <form action={async (formData) => { "use server"; await updateCategory(category.id, formData); }}>
                          <FieldGroup>
                            <Field>
                              <FieldLabel htmlFor={`category-name-${category.id}`}>Category name</FieldLabel>
                              <Input id={`category-name-${category.id}`} name="name" defaultValue={category.name} required />
                            </Field>
                            <Field>
                              <FieldLabel>Category type</FieldLabel>
                              <Select name="kind" defaultValue={category.kind} required>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choose category type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="income">Income</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Button type="submit" variant="outline">Save category</Button>
                          </FieldGroup>
                        </form>
                        <Separator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive">Delete category</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                              <AlertDialogDescription>This hides the category from new entries but keeps older reports readable.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={async () => { "use server"; await archiveCategory(category.id); }}>
                                <AlertDialogAction type="submit" variant="destructive">Delete category</AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryList({ categories }: { categories: Category[] }) {
  const expenseCategories = categories.filter((category) => category.kind === "expense");
  const incomeCategories = categories.filter((category) => category.kind === "income");

  return (
    <>
      <CategorySection
        categories={expenseCategories}
        description="Categories used for shared spending."
        emptyLabel="No expense categories yet"
        title="Expense categories"
      />
      <CategorySection
        categories={incomeCategories}
        description="Categories used for shared income."
        emptyLabel="No income categories yet"
        title="Income categories"
      />
    </>
  );
}
