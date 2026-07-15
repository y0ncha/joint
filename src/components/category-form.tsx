"use client";

import { useActionState, useState } from "react";

import { createCategory } from "@/app/actions/categories";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
