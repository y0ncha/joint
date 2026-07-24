"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { isHexColor } from "@/lib/shared-colors";
import { categorySchema } from "@/lib/validation";

export async function createCategory(input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("categories").insert({ household_id: household.householdId, name: parsed.data.name, kind: parsed.data.kind, color });
  if (error) return { status: "error", formError: "Unable to save the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}

export async function updateCategory(categoryId: string, input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isHexColor(color)) return { status: "error", formError: "Choose a valid color.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("categories").update({ name: parsed.data.name, kind: parsed.data.kind, color }).eq("id", categoryId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}

export async function archiveCategory(categoryId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", categoryId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to archive the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}
