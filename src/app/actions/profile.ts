"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { isHexColor } from "@/lib/shared-colors";

const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Enter a display name."),
});

export async function saveCurrentProfileName(previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("profiles").update({ full_name: parsed.data.name }).eq("id", household.userId);
  if (error) return { status: "error", formError: "Unable to save your name. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  return { status: "success", data: { fullName: parsed.data.name } };
}

export async function saveMemberColor(userId: string, color: string): Promise<ActionResult> {
  if (!isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("set_household_member_color", { target_user_id: userId, target_color: color });
  if (error) return { status: "error", formError: "Unable to save your color. Please try again.", fieldErrors: {} };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { status: "success" };
}
