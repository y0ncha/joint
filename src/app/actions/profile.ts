"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";

const profileNameSchema = z.object({
  name: z.string().trim().regex(/^\S+\s+\S+$/, "Enter your first and last name."),
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
