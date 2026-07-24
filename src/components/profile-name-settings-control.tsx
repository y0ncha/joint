"use client";

import { useActionState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";

import { saveCurrentProfileName } from "@/app/actions/profile";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function ProfileNameSettingsControl({ fullName, userId }: { fullName: string; userId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveCurrentProfileName, null);
  const hasNameError = state?.status === "error" && Boolean(state.fieldErrors.name);

  useEffect(() => {
    if (state?.status !== "success") return;
    localStorage.setItem(`joint-profile-name:${userId}`, state.data?.fullName ?? "");
    window.dispatchEvent(new Event("joint-profile-name-updated"));
  }, [state, userId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 border-transparent bg-white/55">Edit</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <PopoverHeader>
          <PopoverTitle>Edit display name</PopoverTitle>
        </PopoverHeader>
        <form action={formAction} className="mt-4">
          <FieldGroup>
            <Field data-invalid={hasNameError}>
              <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
              <Input id="profile-name" name="name" defaultValue={fullName} autoComplete="name" required aria-invalid={hasNameError} aria-describedby={hasNameError ? "profile-name-error" : undefined} />
              {hasNameError ? <FieldError id="profile-name-error">{state.fieldErrors.name}</FieldError> : null}
            </Field>
            {state?.status === "error" && state.formError ? <FieldError>{state.formError}</FieldError> : null}
            <Button type="submit" disabled={isPending} className="min-h-11 w-full">
              {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
              {isPending ? "Saving name…" : "Save name"}
            </Button>
            <p aria-live="polite" className="sr-only">{isPending ? "Saving name…" : state?.status === "success" ? "Name saved." : state?.status === "error" ? state.formError : ""}</p>
          </FieldGroup>
        </form>
      </PopoverContent>
    </Popover>
  );
}
