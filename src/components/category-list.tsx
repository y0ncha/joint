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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <Card className="border-white/50 bg-card/90">
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Household-owned income and expense categories.</CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet</p>
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 truncate font-medium">{category.name}</span>
                        <CategoryKindBadge category={category} />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="gap-5 rounded-2xl border-white/70 bg-popover/98 p-5 shadow-[0_24px_80px_rgba(15,44,55,0.24)] backdrop-blur-xl sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Edit category</DialogTitle>
                        <DialogDescription>Rename this category, change its type, or delete it from new entries.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-4">
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
                    </DialogContent>
                  </Dialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
