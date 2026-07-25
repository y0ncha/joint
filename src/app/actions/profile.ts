"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { isHexColor } from "@/lib/shared-colors";

const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Enter a display name."),
});

function changedValue(formData: FormData, name: string, initialName: string) {
  const value = formData.get(name);
  const initialValue = formData.get(initialName);
  return typeof value === "string" && typeof initialValue === "string" && value.trim() !== initialValue.trim() ? value : null;
}

export async function saveSettings(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profileName = changedValue(formData, "profileName", "initialProfileName");
  const householdName = changedValue(formData, "householdName", "initialHouseholdName");
  const color = changedValue(formData, "color", "initialColor");
  const parsedProfileName = profileName === null ? null : profileNameSchema.safeParse({ name: profileName });
  const parsedHouseholdName = householdName === null ? null : profileNameSchema.safeParse({ name: householdName });

  if (parsedProfileName && !parsedProfileName.success) return validationError(parsedProfileName.error.issues);
  if (parsedHouseholdName && !parsedHouseholdName.success) return validationError(parsedHouseholdName.error.issues);
  if (color !== null && !isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };
  if (profileName === null && householdName === null && color === null) {
    return { status: "success", data: { fullName: String(formData.get("profileName") ?? "") } };
  }

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("save_current_settings", {
    profile_name: parsedProfileName?.success ? parsedProfileName.data.name : null,
    household_name: parsedHouseholdName?.success ? parsedHouseholdName.data.name : null,
    member_color: color,
  });
  if (error) return { status: "error", formError: "Unable to save settings. Please try again.", fieldErrors: {} };

  if (profileName !== null || householdName !== null || color !== null) {
    revalidatePath("/settings");
    if (color !== null) revalidatePath("/transactions");
  }
  return {
    status: "success",
    data: { fullName: parsedProfileName?.success ? parsedProfileName.data.name : String(formData.get("profileName") ?? "") },
  };
}
