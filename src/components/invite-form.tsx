"use client";

import { useActionState, useState } from "react";

import { createInvitation } from "@/app/actions/invitations";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_state, formData) => createInvitation(formData), null);
  const [copied, setCopied] = useState(false);
  const invitationUrl = state?.status === "success" ? state.data?.invitationUrl : undefined;
  const copy = async () => {
    if (!invitationUrl) return;
    await navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
  };
  return (
    <form action={action}>
      <FieldGroup>
        <Field data-invalid={state?.status === "error" && Boolean(state.fieldErrors.email)}>
          <FieldLabel htmlFor="invite-email">Partner&apos;s Google email</FieldLabel>
          <Input id="invite-email" name="email" type="email" required aria-invalid={state?.status === "error" && Boolean(state.fieldErrors.email)} />
          {state?.status === "error" ? <FieldError>{state.fieldErrors.email}</FieldError> : null}
        </Field>
        <Button type="submit" disabled={pending}>Create invite link</Button>
        {state?.status === "error" ? <FieldError>{state.formError}</FieldError> : null}
        {invitationUrl ? (
          <Field>
            <FieldLabel htmlFor="invite-link">Invite link</FieldLabel>
            <Input id="invite-link" value={invitationUrl} readOnly />
            <Button type="button" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy invite link"}</Button>
            <FieldDescription>Add this Google account as a test user in Google Cloud before they sign in.</FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
    </form>
  );
}
