"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";

const memberCardSchema = z.object({
  lastFour: z.string().regex(/^[0-9]{4}$/, "Enter exactly four digits."),
});

export async function saveCurrentMemberCard(previousState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = memberCardSchema.safeParse({ lastFour: formData.get("lastFour") });
  if (!parsed.success) return validationError(parsed.error.issues);

  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("member_card_mappings").insert({
    household_id: household.householdId,
    user_id: household.userId,
    last_four: parsed.data.lastFour,
  });

  if (error?.code === "23505" && error.message.includes("member_card_mappings_pkey")) {
    const { error: updateError } = await household.supabase
      .from("member_card_mappings")
      .update({ last_four: parsed.data.lastFour })
      .eq("household_id", household.householdId)
      .eq("user_id", household.userId);

    if (updateError?.code === "23505" && updateError.message.includes("member_card_mappings_household_id_last_four_key")) {
      return {
        status: "error",
        formError: "Check the form details.",
        fieldErrors: { lastFour: "These last four digits are already mapped in this household." },
      };
    }
    if (updateError) return { status: "error", formError: "Unable to save the card mapping. Please try again.", fieldErrors: {} };
    revalidatePath("/setup/card");
    revalidatePath("/settings");
    revalidatePath("/transactions/import");
    return { status: "success" };
  }
  if (error?.code === "23505" && error.message.includes("member_card_mappings_household_id_last_four_key")) {
    return {
      status: "error",
      formError: "Check the form details.",
      fieldErrors: { lastFour: "These last four digits are already mapped in this household." },
    };
  }
  if (error) return { status: "error", formError: "Unable to save the card mapping. Please try again.", fieldErrors: {} };

  revalidatePath("/setup/card");
  revalidatePath("/settings");
  revalidatePath("/transactions/import");
  return { status: "success" };
}
