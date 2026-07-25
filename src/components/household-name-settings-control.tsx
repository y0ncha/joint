"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

import { saveCurrentHouseholdName } from "@/app/actions/profile";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function HouseholdNameSettingsControl({ name }: { name: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveCurrentHouseholdName, null);
  const hasNameError = state?.status === "error" && Boolean(state.fieldErrors.name);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 border-transparent bg-white/55">Edit</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <PopoverHeader>
          <PopoverTitle>Edit household name</PopoverTitle>
        </PopoverHeader>
        <form action={formAction} className="mt-4">
          <FieldGroup>
            <Field data-invalid={hasNameError}>
              <FieldLabel htmlFor="household-name">Household name</FieldLabel>
              <Input id="household-name" name="name" defaultValue={name} required aria-invalid={hasNameError} aria-describedby={hasNameError ? "household-name-error" : undefined} />
              {hasNameError ? <FieldError id="household-name-error">{state.fieldErrors.name}</FieldError> : null}
            </Field>
            {state?.status === "error" && state.formError ? <FieldError>{state.formError}</FieldError> : null}
            <Button type="submit" disabled={isPending} className="min-h-11 w-full">
              {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
              {isPending ? "Saving household name…" : "Save household name"}
            </Button>
            <p aria-live="polite" className="sr-only">{isPending ? "Saving household name…" : state?.status === "success" ? "Household name saved." : state?.status === "error" ? state.formError : ""}</p>
          </FieldGroup>
        </form>
      </PopoverContent>
    </Popover>
  );
}
