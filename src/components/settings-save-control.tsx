"use client";

import { createContext, useActionState, useContext, useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { logOut } from "@/app/actions/auth";
import { saveSettings } from "@/app/actions/profile";
import type { ActionResult } from "@/app/actions/result";
import { serializeAccentCookie } from "@/lib/accent";
import { Button } from "@/components/ui/button";
import { WorkspacePage } from "@/components/workspace-shell";
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

export function hasUnsavedSettings(formData: FormData) {
  return [
    ["profileName", "initialProfileName"],
    ["householdName", "initialHouseholdName"],
    ["color", "initialColor"],
    ["accentColor", "initialAccentColor"],
    ["lastFour", "initialLastFour"],
  ].some(([name, initialName]) => String(formData.get(name) ?? "").trim() !== String(formData.get(initialName) ?? "").trim());
}

const SettingsFormContext = createContext<ActionResult | null>(null);

export function useSettingsFormState() {
  return useContext(SettingsFormContext);
}

function hasDirtySettingsForm() {
  const form = document.getElementById("settings-save-form") as HTMLFormElement | null;
  return form ? hasUnsavedSettings(new FormData(form)) : false;
}

function markSettingsSaved() {
  const form = document.getElementById("settings-save-form") as HTMLFormElement | null;
  if (!form) return;

  [
    ["profileName", "initialProfileName"],
    ["householdName", "initialHouseholdName"],
    ["color", "initialColor"],
    ["accentColor", "initialAccentColor"],
    ["lastFour", "initialLastFour"],
  ].forEach(([name, initialName]) => {
    const value = form.elements.namedItem(name);
    const initialValue = form.elements.namedItem(initialName);
    if (value instanceof HTMLInputElement && initialValue instanceof HTMLInputElement) initialValue.value = value.value;
  });
}

export function SettingsForm({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(saveSettings, null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.status !== "success" || !state.data?.fullName) return;
    localStorage.setItem(`joint-profile-name:${userId}`, state.data.fullName);
    window.dispatchEvent(new Event("joint-profile-name-updated"));
  }, [state, userId]);

  useEffect(() => {
    if (state?.status === "success") {
      const form = document.getElementById("settings-save-form") as HTMLFormElement | null;
      const accent = form?.elements.namedItem("accentColor");
      if (accent instanceof HTMLInputElement) document.cookie = serializeAccentCookie(accent.value, window.location.protocol === "https:");
      markSettingsSaved();
    }
    if (state?.status === "success") toast.success("Saved", { id: "settings-save" });
    if (state?.status === "error") toast.error(state.formError, { id: "settings-save" });
  }, [state]);

  useEffect(() => {
    function confirmNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !hasDirtySettingsForm()
      )
        return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target || link.hasAttribute("download")) return;

      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;

      event.preventDefault();
      setLeaveTo(`${url.pathname}${url.search}${url.hash}`);
    }

    function confirmUnload(event: BeforeUnloadEvent) {
      if (!hasDirtySettingsForm()) return;
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
    <SettingsFormContext.Provider value={state}>
      <form
        id="settings-logout-form"
        data-settings-logout="true"
        action={logOut}
        onSubmit={(event) => {
          if (hasDirtySettingsForm()) {
            event.preventDefault();
            setLeaveTo("logout");
          }
        }}
      />
      <form id="settings-save-form" action={formAction}>
        <WorkspacePage
          title="Settings"
          actions={
            <>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-14 text-foreground"
                disabled={isPending}
                aria-label="Save changes"
              >
                {isPending ? (
                  <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />
                ) : (
                  <Save aria-hidden="true" />
                )}
              </Button>
              <Button
                form="settings-logout-form"
                type="submit"
                variant="ghost"
                size="icon"
                className="size-14 text-foreground"
                aria-label="Log out"
              >
                <LogOut aria-hidden="true" />
              </Button>
            </>
          }
        >
          {children}
        </WorkspacePage>
      </form>
      <AlertDialog
        open={Boolean(leaveTo)}
        onOpenChange={(open) => {
          if (!open) setLeaveTo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep editing</AlertDialogCancel>
            {leaveTo === "logout" ? (
              <form action={logOut}>
                <AlertDialogAction type="submit" variant="destructive" className="min-h-11">
                  Leave without saving
                </AlertDialogAction>
              </form>
            ) : (
              <AlertDialogAction
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={() => {
                  if (leaveTo) router.push(leaveTo);
                }}
              >
                Leave without saving
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsFormContext.Provider>
  );
}
