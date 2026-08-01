"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, Pencil, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getProfileInitials } from "@/lib/profile";

const initialState: ActionResult | null = null;

export type PartnerAccessState = { status: "empty" } | { status: "pending" | "joined"; email: string };

type Member = { name: string; email: string; joinedAt?: string };

function MemberIdentity({ member }: { member: Member }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-3 pt-1.5">
      <div className="min-w-0">
        <CardTitle className="truncate !text-xl !leading-7">{member.name}</CardTitle>
      </div>
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{getProfileInitials(member.name)}</AvatarFallback>
      </Avatar>
    </div>
  );
}

function MemberMetadata({ member }: { member: Member }) {
  return (
    <CardContent className="px-4 pt-4 text-sm">
      <dl className="divide-y divide-border/70">
        <div className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2">
          <dt className="font-medium text-muted-foreground">Email</dt>
          <dd className="min-w-0 truncate font-medium">{member.email}</dd>
        </div>
        {member.joinedAt ? (
          <div className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2">
            <dt className="font-medium text-muted-foreground">Joined</dt>
            <dd className="font-medium">{member.joinedAt.slice(0, 10).split("-").reverse().join("/")}</dd>
          </div>
        ) : null}
      </dl>
    </CardContent>
  );
}

export function MemberManagementSheet({ owner, partner, member }: { owner: Member; partner: PartnerAccessState; member?: Member }) {
  const [open, setOpen] = useState(false);
  const [saveState, saveAction, saving] = useActionState<ActionResult | null, FormData>(
    async (_state, formData) => setAllowedPartnerEmail(formData),
    initialState,
  );
  const [removeState, removeAction, removing] = useActionState<ActionResult | null, FormData>(async () => {
    const result = await removePartner();
    if (result.status === "success") setOpen(false);
    return result;
  }, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (saveState?.status === "error") emailRef.current?.focus();
  }, [saveState]);

  useEffect(() => {
    if (saveState?.status === "success") toast.success("Invitation saved", { id: "member-invitation" });
    if (saveState?.status === "error") toast.error(saveState.formError, { id: "member-invitation" });
  }, [saveState]);

  useEffect(() => {
    if (removeState?.status === "success") toast.success("Member removed", { id: "member-remove" });
    if (removeState?.status === "error") toast.error(removeState.formError, { id: "member-remove" });
  }, [removeState]);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button ref={triggerRef} type="button" variant="ghost" size="icon" className="size-11" aria-label="Manage members">
          <Pencil aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
      >
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Household members</SheetTitle>
          <SheetDescription>View your household members and manage partner access.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <Card size="sm" className="border-white/50 bg-card/90">
            <CardHeader>
              <MemberIdentity member={owner} />
            </CardHeader>
            <MemberMetadata member={owner} />
            <CardContent className="flex justify-end pt-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground/40"
                aria-label="Owner cannot be removed"
                title="Owner cannot be removed"
                disabled
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>

          {partner.status === "empty" ? (
            <Card size="sm" className="border-white/50 bg-card/90">
              <CardHeader>
                <CardTitle>Invite member</CardTitle>
                <CardDescription>Authorize one Google account to join this household.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveAction} className="flex flex-wrap items-start gap-2">
                  <Field data-invalid={saveState?.status === "error" && Boolean(saveState.fieldErrors.email)} className="min-w-0 flex-1">
                    <FieldLabel htmlFor="partner-email" className="sr-only">
                      Member&apos;s Google email
                    </FieldLabel>
                    <Input
                      ref={emailRef}
                      id="partner-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      className="min-h-11"
                      placeholder="member@gmail.com"
                      required
                      aria-describedby={saveState?.status === "error" && saveState.fieldErrors.email ? "partner-email-error" : undefined}
                      aria-invalid={saveState?.status === "error" && Boolean(saveState.fieldErrors.email)}
                    />
                    {saveState?.status === "error" && saveState.fieldErrors.email ? (
                      <FieldError id="partner-email-error">{saveState.fieldErrors.email}</FieldError>
                    ) : null}
                  </Field>
                  <Button type="submit" size="icon" disabled={saving} className="size-11" aria-label="Invite member">
                    {saving ? (
                      <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Send aria-hidden="true" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card size="sm" className="border-white/50 bg-card/90">
              <CardHeader>
                {partner.status === "joined" && member ? (
                  <MemberIdentity member={member} />
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{partner.status === "joined" ? "Joined member" : "Invitation pending"}</CardTitle>
                      <CardDescription className="truncate">{partner.email}</CardDescription>
                    </div>
                  </div>
                )}
              </CardHeader>
              {partner.status === "joined" && member ? <MemberMetadata member={member} /> : null}
              <CardContent className="flex justify-end pt-0">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive" aria-label="Remove member">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove partner access?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {partner.status === "joined"
                          ? "This person will no longer be able to view or update this household. Financial history stays unchanged."
                          : `${partner.email} will no longer be authorized to join this household.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <form action={removeAction}>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-11" disabled={removing}>
                          Cancel
                        </AlertDialogCancel>
                        <Button type="submit" variant="destructive" disabled={removing} className="min-h-11">
                          {removing ? (
                            <LoaderCircle
                              aria-hidden="true"
                              data-icon="inline-start"
                              className="motion-safe:animate-spin motion-reduce:animate-none"
                            />
                          ) : null}
                          Remove member
                        </Button>
                      </AlertDialogFooter>
                    </form>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
