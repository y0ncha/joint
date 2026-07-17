"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, UserRound } from "lucide-react";

import { removePartner, setAllowedPartnerEmail } from "@/app/actions/partner-access";
import type { ActionResult } from "@/app/actions/result";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const initialState: ActionResult | null = null;

export type PartnerAccessState =
  | { status: "empty" }
  | { status: "pending" | "joined"; email: string };

export function PartnerAccessControl({ state }: { state: PartnerAccessState }) {
  const [open, setOpen] = useState(false);
  const [saveState, saveAction, saving] = useActionState<ActionResult | null, FormData>(async (_state, formData) => setAllowedPartnerEmail(formData), initialState);
  const [removeState, removeAction, removing] = useActionState<ActionResult | null, FormData>(async () => {
    const result = await removePartner();
    if (result.status === "success") setOpen(false);
    return result;
  }, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const removeErrorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (saveState?.status === "error") emailRef.current?.focus();
  }, [saveState]);

  useEffect(() => {
    if (removeState?.status === "error") removeErrorRef.current?.focus();
  }, [removeState]);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button ref={triggerRef} type="button" variant="outline" size="sm" className="min-h-11 border-transparent bg-white/55">
          Manage partner
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <PopoverHeader>
          <PopoverTitle>Partner access</PopoverTitle>
          <PopoverDescription>{state.status === "empty" ? "Authorize one Google account to join this household." : "Remove this access before authorizing another Google account."}</PopoverDescription>
        </PopoverHeader>
        {state.status !== "empty" ? (
          <FieldGroup>
            <Field>
              <FieldTitle className="flex items-center gap-2">
                <UserRound aria-hidden="true" className="size-4" />
                {state.status === "joined" ? "Joined partner" : "Pending sign-in"}
              </FieldTitle>
              <FieldDescription>{state.email}</FieldDescription>
            </Field>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="min-h-11">Remove partner</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove partner access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {state.status === "joined"
                      ? "This person will no longer be able to view or update this household. Financial history stays unchanged."
                      : `${state.email} will no longer be authorized to join this household.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <form action={removeAction}>
                  {removeState?.status === "error" ? <FieldError ref={removeErrorRef} tabIndex={-1}>{removeState.formError}</FieldError> : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-11" disabled={removing}>Cancel</AlertDialogCancel>
                    <Button type="submit" variant="destructive" disabled={removing} className="min-h-11">
                      {removing ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
                      Remove partner
                    </Button>
                  </AlertDialogFooter>
                </form>
                <p aria-live="polite" className="sr-only">{removing ? "Removing partner…" : ""}</p>
              </AlertDialogContent>
            </AlertDialog>
          </FieldGroup>
        ) : (
          <form action={saveAction}>
            <FieldGroup>
              <Field data-invalid={saveState?.status === "error" && Boolean(saveState.fieldErrors.email)}>
                <FieldLabel htmlFor="partner-email">Partner&apos;s Google email</FieldLabel>
                <Input ref={emailRef} id="partner-email" name="email" type="email" autoComplete="email" spellCheck={false} className="min-h-11" placeholder="partner@example.com…" required aria-describedby={saveState?.status === "error" && saveState.fieldErrors.email ? "partner-email-error" : undefined} aria-invalid={saveState?.status === "error" && Boolean(saveState.fieldErrors.email)} />
                {saveState?.status === "error" && saveState.fieldErrors.email ? <FieldError id="partner-email-error">{saveState.fieldErrors.email}</FieldError> : null}
              </Field>
              {saveState?.status === "error" && saveState.formError ? <FieldError>{saveState.formError}</FieldError> : null}
              <Button type="submit" disabled={saving} className="min-h-11">
                {saving ? <LoaderCircle aria-hidden="true" data-icon="inline-start" className="motion-safe:animate-spin motion-reduce:animate-none" /> : null}
                Save partner access
              </Button>
              <p aria-live="polite" className="sr-only">{saveState?.status === "success" ? "Partner access saved." : saving ? "Saving partner access…" : ""}</p>
            </FieldGroup>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
