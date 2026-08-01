"use client";

import { useEffect, useRef } from "react";

import { useSettingsFormState } from "@/components/settings-save-control";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function GroceriesBudgetSettingsControl({ budget }: { budget: number | null }) {
  const value = budget?.toString() ?? "";
  const state = useSettingsFormState();
  const error = state?.status === "error" ? state.fieldErrors.groceriesBudget : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  return (
    <div className="w-[min(22rem,55vw)]">
      <input form="settings-save-form" type="hidden" name="initialGroceriesBudget" value={value} />
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="groceries-budget" className="sr-only">
          Monthly groceries budget
        </FieldLabel>
        <Input
          ref={inputRef}
          form="settings-save-form"
          id="groceries-budget"
          name="groceriesBudget"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={value}
          placeholder="Not set"
          inputMode="decimal"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "groceries-budget-error" : undefined}
          className="min-h-11"
        />
        {error ? <FieldError id="groceries-budget-error">{error}</FieldError> : null}
      </Field>
    </div>
  );
}
