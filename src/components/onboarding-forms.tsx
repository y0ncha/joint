"use client";

import { useActionState } from "react";

import { acceptInvitation, createHousehold, type ActionResult } from "@/app/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionResult | null = null;

function FormError({ state }: { state: ActionResult | null }) {
  if (!state) return null;

  return <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{state.formError}</p>;
}

export function CreateHouseholdForm() {
  const [state, formAction, isPending] = useActionState(
    async (_previousState: ActionResult | null, formData: FormData) => createHousehold(formData),
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <Label htmlFor="household-name">Household name</Label>
      <Input aria-describedby={state?.fieldErrors.name ? "household-name-error" : undefined} className="h-12 rounded-xl" id="household-name" name="name" placeholder="Our home" required />
      {state?.fieldErrors.name ? <p className="text-sm text-destructive" id="household-name-error">{state.fieldErrors.name}</p> : null}
      <FormError state={state} />
      <Button className="h-12 w-full rounded-xl text-base" disabled={isPending} type="submit">Create household</Button>
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
      <input name="token" type="hidden" value={token} />
      <FormError state={state} />
      <Button className="h-12 w-full rounded-xl text-base" disabled={isPending} type="submit">Accept invitation</Button>
    </form>
  );
}
