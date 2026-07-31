"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { isHexColor } from "@/lib/shared-colors";
import { groceriesBudgetSchema } from "@/lib/validation";

const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Enter a display name."),
});
const lastFourSchema = z.string().regex(/^[0-9]{4}$/, "Enter exactly four digits.");

function changedValue(formData: FormData, name: string, initialName: string) {
  const value = formData.get(name);
  const initialValue = formData.get(initialName);
  return typeof value === "string" && typeof initialValue === "string" && value.trim() !== initialValue.trim() ? value : null;
}

export async function saveSettings(_previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profileName = changedValue(formData, "profileName", "initialProfileName");
  const householdName = changedValue(formData, "householdName", "initialHouseholdName");
  const color = changedValue(formData, "color", "initialColor");
  const lastFour = changedValue(formData, "lastFour", "initialLastFour");
  const groceriesBudget = changedValue(formData, "groceriesBudget", "initialGroceriesBudget");
  const parsedProfileName = profileName === null ? null : profileNameSchema.safeParse({ name: profileName });
  const parsedHouseholdName = householdName === null ? null : profileNameSchema.safeParse({ name: householdName });
  const parsedLastFour = lastFour === null ? null : lastFourSchema.safeParse(lastFour);
  const parsedGroceriesBudget = groceriesBudgetSchema.safeParse(groceriesBudget ?? formData.get("initialGroceriesBudget"));

  if (parsedProfileName && !parsedProfileName.success) return validationError(parsedProfileName.error.issues);
  if (parsedHouseholdName && !parsedHouseholdName.success) return validationError(parsedHouseholdName.error.issues);
  if (parsedLastFour && !parsedLastFour.success) return validationError(parsedLastFour.error.issues);
  if (!parsedGroceriesBudget.success) return validationError(parsedGroceriesBudget.error.issues);
  if (color !== null && !isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };
  if (profileName === null && householdName === null && color === null && lastFour === null && groceriesBudget === null) {
    return { status: "success", data: { fullName: String(formData.get("profileName") ?? "") } };
  }

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("save_current_settings", {
    ...(parsedProfileName?.success ? { profile_name: parsedProfileName.data.name } : {}),
    ...(parsedHouseholdName?.success ? { household_name: parsedHouseholdName.data.name } : {}),
    ...(color === null ? {} : { member_color: color }),
    ...(parsedLastFour?.success ? { member_card_last_four: parsedLastFour.data } : {}),
    groceries_monthly_budget: parsedGroceriesBudget.data,
  });
  if (error?.code === "23505" && error.message.includes("member_cards_household_id_last_four_key")) {
    return {
      status: "error",
      formError: "Check the form details.",
      fieldErrors: { lastFour: "These last four digits are already mapped in this household." },
    };
  }
  if (error) return { status: "error", formError: "Unable to save settings. Please try again.", fieldErrors: {} };

  if (profileName !== null || householdName !== null || color !== null || lastFour !== null || groceriesBudget !== null) {
    revalidatePath("/settings");
    if (color !== null) revalidatePath("/transactions");
    if (groceriesBudget !== null) revalidatePath("/bills-groceries");
  }
  return {
    status: "success",
    data: { fullName: parsedProfileName?.success ? parsedProfileName.data.name : String(formData.get("profileName") ?? "") },
  };
}
