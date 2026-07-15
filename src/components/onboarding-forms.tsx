"use client";

import { useActionState } from "react";

import { acceptInvitation, createHousehold, type ActionResult } from "@/app/actions/household";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: ActionResult | null = null;

function FormError({ state }: { state: ActionResult | null }) {
  if (!state) return null;

  return <FieldError className="rounded-xl bg-destructive/10 px-3 py-2">{state.formError}</FieldError>;
}

export function CreateHouseholdForm() {
  const [state, formAction, isPending] = useActionState(
    async (_previousState: ActionResult | null, formData: FormData) => createHousehold(formData),
    initialState,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="mt-8">
      <FieldGroup>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)}>
          <FieldLabel htmlFor="household-name">Household name</FieldLabel>
          <Input aria-describedby={state?.fieldErrors.name ? "household-name-error" : undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)} className="h-12 rounded-xl" id="household-name" name="name" placeholder="Our home" required />
          {state?.fieldErrors.name ? <FieldError id="household-name-error">{state.fieldErrors.name}</FieldError> : null}
        </Field>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalance)}>
          <FieldLabel htmlFor="opening-balance">Initial shared balance</FieldLabel>
          <Input aria-describedby={state?.fieldErrors.openingBalance ? "opening-balance-error" : undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalance)} className="h-12 rounded-xl" id="opening-balance" inputMode="decimal" name="openingBalance" placeholder="0.00" required />
          {state?.fieldErrors.openingBalance ? <FieldError id="opening-balance-error">{state.fieldErrors.openingBalance}</FieldError> : null}
        </Field>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalanceDate)}>
          <FieldLabel htmlFor="opening-balance-date">Balance date</FieldLabel>
          <Input aria-describedby={state?.fieldErrors.openingBalanceDate ? "opening-balance-date-error" : undefined} aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalanceDate)} className="h-12 rounded-xl" id="opening-balance-date" name="openingBalanceDate" type="date" defaultValue={today} required />
          {state?.fieldErrors.openingBalanceDate ? <FieldError id="opening-balance-date-error">{state.fieldErrors.openingBalanceDate}</FieldError> : null}
        </Field>
        <FormError state={state} />
        <Button className="h-12 w-full rounded-xl text-base" disabled={isPending} type="submit">Create household</Button>
      </FieldGroup>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_previousState: ActionResult | null, formData: FormData) => acceptInvitation(formData),
    initialState,
  );

  return (
    <form action={formAction} className="mt-8">
      <FieldGroup>
        <input name="token" type="hidden" value={token} />
        <FormError state={state} />
        <Button className="h-12 w-full rounded-xl text-base" disabled={isPending} type="submit">Accept invitation</Button>
      </FieldGroup>
    </form>
  );
}
