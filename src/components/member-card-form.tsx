"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";

import { saveCurrentMemberCard } from "@/app/actions/member-card";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function MemberCardForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveCurrentMemberCard, null);

  useEffect(() => {
    if (state?.status === "success") router.replace("/");
  }, [router, state]);

  const hasLastFourError = state?.status === "error" && Boolean(state.fieldErrors.lastFour);
  const result = state?.status === "success"
    ? "Card saved. Opening your household…"
    : isPending
      ? "Saving card…"
      : state?.status === "error"
        ? state.formError
        : "";

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={hasLastFourError}>
          <FieldLabel htmlFor="card-last-four">Last four digits</FieldLabel>
          <Input
            id="card-last-four"
            name="lastFour"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            required
            spellCheck={false}
            className="min-h-11 font-mono tracking-[0.3em]"
            aria-invalid={hasLastFourError}
            aria-describedby={hasLastFourError ? "card-last-four-error" : undefined}
          />
          <FieldDescription>Joint never stores your full card number. These digits only match your statement imports.</FieldDescription>
          {hasLastFourError ? <FieldError id="card-last-four-error">{state.fieldErrors.lastFour}</FieldError> : null}
        </Field>
        {state?.status === "error" && state.formError ? <FieldError>{state.formError}</FieldError> : null}
        <Button type="submit" disabled={isPending} className="min-h-11 w-full">
          {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
          {isPending ? "Saving card…" : "Save card"}
        </Button>
        <Button asChild variant="link" className="min-h-11 self-center">
          <Link href="/">Skip for now</Link>
        </Button>
        <p aria-live="polite" className="sr-only">{result}</p>
      </FieldGroup>
    </form>
  );
}
