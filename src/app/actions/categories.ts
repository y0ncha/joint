"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation";

export async function createCategory(input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await (await createServerSupabaseClient()).from("categories").insert({ household_id: household.householdId, name: parsed.data.name, kind: parsed.data.kind });
  if (error) return { status: "error", formError: "Unable to save the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}

export async function updateCategory(categoryId: string, input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const household = await requireCurrentHousehold();
  const { error } = await (await createServerSupabaseClient()).from("categories").update({ name: parsed.data.name, kind: parsed.data.kind }).eq("id", categoryId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}

export async function archiveCategory(categoryId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await (await createServerSupabaseClient()).from("categories").update({ archived_at: new Date().toISOString() }).eq("id", categoryId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to archive the category. Please try again.", fieldErrors: {} };
  revalidatePath("/"); revalidatePath("/categories");
  return { status: "success" };
}
