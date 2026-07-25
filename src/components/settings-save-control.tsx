"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveSettings } from "@/app/actions/profile";
import type { ActionResult } from "@/app/actions/result";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function hasUnsavedSettings(formData: FormData) {
  return [["profileName", "initialProfileName"], ["householdName", "initialHouseholdName"], ["color", "initialColor"]].some(([name, initialName]) =>
    String(formData.get(name) ?? "").trim() !== String(formData.get(initialName) ?? "").trim(),
  );
}

export function SettingsSaveControl({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveSettings, null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.status !== "success" || !state.data?.fullName) return;
    localStorage.setItem(`joint-profile-name:${userId}`, state.data.fullName);
    window.dispatchEvent(new Event("joint-profile-name-updated"));
  }, [state, userId]);

  useEffect(() => {
    if (state?.status === "success") toast.success("Saved", { id: "settings-save" });
    if (state?.status === "error") toast.error(state.formError, { id: "settings-save" });
  }, [state]);

  useEffect(() => {
    function isDirty() {
      const form = document.getElementById("settings-save-form") as HTMLFormElement | null;
      return form ? hasUnsavedSettings(new FormData(form)) : false;
    }

    function confirmNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !isDirty()) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.target || link.hasAttribute("download")) return;

      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;

      event.preventDefault();
      setLeaveTo(`${url.pathname}${url.search}${url.hash}`);
    }

    function confirmUnload(event: BeforeUnloadEvent) {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", confirmNavigation, true);
    window.addEventListener("beforeunload", confirmUnload);
    return () => {
      document.removeEventListener("click", confirmNavigation, true);
      window.removeEventListener("beforeunload", confirmUnload);
    };
  }, []);

  return (
    <>
      <form id="settings-save-form" action={formAction} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button form="settings-save-form" type="submit" variant="ghost" size="icon" className="size-14 text-foreground hover:bg-transparent hover:text-foreground" disabled={isPending} aria-label="Save changes">
            {isPending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
      <AlertDialog open={Boolean(leaveTo)} onOpenChange={(open) => { if (!open) setLeaveTo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep editing</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" className="min-h-11" onClick={() => { if (leaveTo) router.push(leaveTo); }}>Leave without saving</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
