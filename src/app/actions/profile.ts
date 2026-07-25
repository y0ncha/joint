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
  const parsedProfileName = profileNameSchema.safeParse({ name: profileName });
  const parsedHouseholdName = householdName === null ? null : profileNameSchema.safeParse({ name: householdName });

  if (profileName !== null && !parsedProfileName.success) return validationError(parsedProfileName.error.issues);
  if (parsedHouseholdName && !parsedHouseholdName.success) return validationError(parsedHouseholdName.error.issues);
  if (color !== null && !isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };

  const household = await requireCurrentHousehold();
  if (householdName !== null && household.role !== "owner") return { status: "error", formError: "Only the household owner can change its name.", fieldErrors: {} };

  if (profileName !== null) {
    const { error } = await household.supabase.from("profiles").update({ full_name: parsedProfileName.data.name }).eq("id", household.userId);
    if (error) return { status: "error", formError: "Unable to save your name. Please try again.", fieldErrors: {} };
  }
  if (parsedHouseholdName?.success) {
    const { error } = await household.supabase.from("households").update({ name: parsedHouseholdName.data.name }).eq("id", household.householdId);
    if (error) return { status: "error", formError: "Unable to save the household name. Please try again.", fieldErrors: {} };
  }
  if (color !== null) {
    const { error } = await household.supabase.rpc("set_current_household_member_color", { target_color: color });
    if (error) return { status: "error", formError: "Unable to save your color. Please try again.", fieldErrors: {} };
  }

  if (profileName !== null || householdName !== null || color !== null) {
    revalidatePath("/settings");
    if (color !== null) revalidatePath("/transactions");
  }
  return { status: "success", data: { fullName: parsedProfileName.success ? parsedProfileName.data.name : String(formData.get("profileName") ?? "") } };
}

export async function saveCurrentProfileName(previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("profiles").update({ full_name: parsed.data.name }).eq("id", household.userId);
  if (error) return { status: "error", formError: "Unable to save your name. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  return { status: "success", data: { fullName: parsed.data.name } };
}

export async function saveCurrentMemberColor(color: string): Promise<ActionResult> {
  if (!isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("set_current_household_member_color", { target_color: color });
  if (error) return { status: "error", formError: "Unable to save your color. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { status: "success" };
}

export async function saveCurrentHouseholdName(previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  if (household.role !== "owner") return { status: "error", formError: "Only the household owner can change its name.", fieldErrors: {} };

  const { error } = await household.supabase.from("households").update({ name: parsed.data.name }).eq("id", household.householdId);
  if (error) return { status: "error", formError: "Unable to save the household name. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  return { status: "success", data: { name: parsed.data.name } };
}
