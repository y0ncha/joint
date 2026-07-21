"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { saveCurrentMemberCard } from "@/app/actions/member-card";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function MemberCardForm({ initialLastFour, redirectTo = "/", showSkip = true }: { initialLastFour?: string; redirectTo?: string; showSkip?: boolean }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveCurrentMemberCard, null);

  useEffect(() => {
    if (state?.status === "success") router.replace(redirectTo);
  }, [redirectTo, router, state]);

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
        <Field data-invalid={hasLastFourError} className="gap-8">
          <FieldLabel htmlFor="card-last-four">Last four digits</FieldLabel>
          <InputOTP
            id="card-last-four"
            name="lastFour"
            maxLength={4}
            pattern={REGEXP_ONLY_DIGITS}
            defaultValue={initialLastFour}
            autoComplete="off"
            required
            aria-invalid={hasLastFourError}
            aria-describedby={hasLastFourError ? "card-last-four-error" : undefined}
            containerClassName="my-10 justify-center"
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={0} className="size-11 rounded-xl border text-lg font-mono first:rounded-xl first:border last:rounded-xl" />
              <InputOTPSlot index={1} className="size-11 rounded-xl border text-lg font-mono first:rounded-xl first:border last:rounded-xl" />
              <InputOTPSlot index={2} className="size-11 rounded-xl border text-lg font-mono first:rounded-xl first:border last:rounded-xl" />
              <InputOTPSlot index={3} className="size-11 rounded-xl border text-lg font-mono first:rounded-xl first:border last:rounded-xl" />
            </InputOTPGroup>
          </InputOTP>
          <FieldDescription className="flex flex-col gap-1">
            <span>Optionally match imported statement rows to you.</span>
            <span>Only used to match statement imports.</span>
          </FieldDescription>
          {hasLastFourError ? <FieldError id="card-last-four-error">{state.fieldErrors.lastFour}</FieldError> : null}
        </Field>
        {state?.status === "error" && state.formError ? <FieldError>{state.formError}</FieldError> : null}
        <Button type="submit" disabled={isPending} className="min-h-11 w-full">
          {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
          {isPending ? "Saving card…" : "Save card"}
        </Button>
        {showSkip ? <Button asChild variant="link" className="-mt-3 min-h-11 self-center">
          <Link href="/">Skip for now</Link>
        </Button> : null}
        <p aria-live="polite" className="sr-only">{result}</p>
      </FieldGroup>
    </form>
  );
}
