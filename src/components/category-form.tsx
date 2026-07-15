"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { createCategory } from "@/app/actions/categories";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const categoryKindItemClassName = "transition-[background-color,border-color,color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm hover:data-[state=on]:bg-primary hover:data-[state=on]:text-primary-foreground";

export function CategoryForm() {
  const [kind, setKind] = useState("expense");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => createCategory(formData), null);

  return (
    <form action={formAction}>
      <FieldGroup>
        <input name="kind" type="hidden" value={kind} />
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)}>
          <FieldLabel htmlFor="category-name">Category name</FieldLabel>
          <Input id="category-name" name="name" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)} />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.name}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel id="category-kind-label">Category type</FieldLabel>
          <ToggleGroup aria-labelledby="category-kind-label" type="single" value={kind} onValueChange={(value) => value && setKind(value)} variant="outline" spacing={0}>
            <ToggleGroupItem value="expense" className={categoryKindItemClassName}>Expense</ToggleGroupItem>
            <ToggleGroupItem value="income" className={categoryKindItemClassName}>Income</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
        <Button disabled={isPending} type="submit">Add category</Button>
      </FieldGroup>
    </form>
  );
}

export function CategorySheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary hover:bg-primary/10 hover:text-primary" aria-label="Add category">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-sm transition-colors group-hover/button:bg-primary">
            <Plus aria-hidden="true" />
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Add category</SheetTitle>
          <SheetDescription>Create the categories used in monthly reporting.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <CategoryForm />
        </div>
      </SheetContent>
    </Sheet>
  );
}
