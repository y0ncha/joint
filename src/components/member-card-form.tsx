"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";

import { saveCurrentMemberCard } from "@/app/actions/member-card";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function MemberCardForm({ initialLastFour, redirectTo = "/", showSkip = true }: { initialLastFour?: string; redirectTo?: string; showSkip?: boolean }) {
  const router = useRouter();
  const [lastFour, setLastFour] = useState(initialLastFour ?? "");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveCurrentMemberCard, null);

  useEffect(() => {
    if (state?.status === "success") {
      toast.success("Card saved", { id: "member-card-save" });
      router.replace(redirectTo);
    }
    if (state?.status === "error") toast.error(state.formError, { id: "member-card-save" });
  }, [redirectTo, router, state]);

  const hasLastFourError = state?.status === "error" && Boolean(state.fieldErrors.lastFour);
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
            value={lastFour}
            onChange={setLastFour}
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
        <Button type="submit" disabled={isPending} className="min-h-11 w-full">
          {isPending ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
          {isPending ? "Saving card…" : "Save card"}
        </Button>
        {showSkip ? <Button asChild variant="link" className="-mt-3 min-h-11 self-center">
          <Link href="/">Skip for now</Link>
        </Button> : null}
      </FieldGroup>
    </form>
  );
}
