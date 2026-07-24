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
import { CategoryColorPicker } from "@/components/category-form";
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
import { PillSelect } from "@/components/pill-select";
import { Separator } from "@/components/ui/separator";

type Category = { id: string; name: string; kind: "income" | "expense"; color?: string; transactionCount: number; archived_at: string | null };

function CategoryNameBadge({ category }: { category: Category }) {
  return (
    <Badge
      variant="outline"
      color={category.color}
      className="max-w-full truncate"
    >
      {category.name}
    </Badge>
  );
}

function CategorySection({
  categories,
  recentColors,
  description,
  emptyLabel,
  title,
}: {
  categories: Category[];
  recentColors: string[];
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
                    <CategoryNameBadge category={category} />
                    <span className="text-sm text-muted-foreground">{category.transactionCount} {category.transactionCount === 1 ? "transaction" : "transactions"}</span>
                  </div>
                ) : (
                  <Sheet>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <CategoryNameBadge category={category} />
                        <span className="text-sm text-muted-foreground">{category.transactionCount} {category.transactionCount === 1 ? "transaction" : "transactions"}</span>
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
                              <PillSelect ariaLabel="Category type" name="kind" defaultValue={category.kind} options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }]} />
                            </Field>
                            <CategoryColorPicker defaultColor={category.color} recentColors={recentColors} />
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

export function CategoryList({ categories, recentColors = [] }: { categories: Category[]; recentColors?: string[] }) {
  const expenseCategories = categories.filter((category) => category.kind === "expense");
  const incomeCategories = categories.filter((category) => category.kind === "income");

  return (
    <>
      <CategorySection
        categories={expenseCategories}
        recentColors={recentColors}
        description="Categories used for shared spending."
        emptyLabel="No expense categories yet"
        title="Expense categories"
      />
      <CategorySection
        categories={incomeCategories}
        recentColors={recentColors}
        description="Categories used for shared income."
        emptyLabel="No income categories yet"
        title="Income categories"
      />
    </>
  );
}
