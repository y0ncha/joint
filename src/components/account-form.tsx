"use client";

import { useActionState, useState } from "react";

import { createAccount } from "@/app/actions/accounts";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const initialState: ActionResult | null = null;

export function AccountForm() {
  const [kind, setKind] = useState("bank");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => createAccount(formData), initialState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <input name="kind" type="hidden" value={kind} />
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)}>
          <FieldLabel htmlFor="account-name">Account name</FieldLabel>
          <Input id="account-name" name="name" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.name)} />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.name}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel id="account-kind-label">Account type</FieldLabel>
          <ToggleGroup aria-labelledby="account-kind-label" type="single" value={kind} onValueChange={(value) => value && setKind(value)} variant="outline" spacing={0}>
            <ToggleGroupItem value="bank">Bank</ToggleGroupItem>
            <ToggleGroupItem value="credit_card">Credit card</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalance)}>
          <FieldLabel htmlFor="opening-balance">Opening balance</FieldLabel>
          <Input id="opening-balance" inputMode="decimal" name="openingBalance" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalance)} />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.openingBalance}</FieldError> : null}
        </Field>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalanceDate)}>
          <FieldLabel htmlFor="opening-date">Opening date</FieldLabel>
          <Input id="opening-date" name="openingBalanceDate" type="date" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.openingBalanceDate)} />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.openingBalanceDate}</FieldError> : null}
        </Field>
        {kind === "credit_card" ? (
          <>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.lastFourDigits)}>
              <FieldLabel htmlFor="last-four-digits">Last 4 card digits</FieldLabel>
              <Input id="last-four-digits" inputMode="numeric" maxLength={4} name="lastFourDigits" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.lastFourDigits)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.lastFourDigits}</FieldError> : null}
            </Field>
            <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.statementCloseDay)}>
              <FieldLabel htmlFor="statement-close-day">Statement close day</FieldLabel>
              <Input id="statement-close-day" inputMode="numeric" max={31} min={1} name="statementCloseDay" required type="number" aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.statementCloseDay)} />
              {state?.status === "error" ? <FieldError>{state.fieldErrors.statementCloseDay}</FieldError> : null}
            </Field>
          </>
        ) : null}
        {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
        <Button disabled={isPending} type="submit">Add {kind === "credit_card" ? "credit card" : "bank account"}</Button>
      </FieldGroup>
    </form>
  );
}
