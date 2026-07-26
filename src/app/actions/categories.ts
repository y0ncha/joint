"use server";

import { revalidatePath } from "next/cache";

import { validationError, type ActionResult } from "@/app/actions/result";
import { requireCurrentHousehold } from "@/lib/household";
import { isCategoryIcon } from "@/lib/category-icons";
import { isCategoryPastelColor, isHexColor } from "@/lib/shared-colors";
import { categorySchema } from "@/lib/validation";

const subcategorySchema = categorySchema.pick({ name: true });
const updateSubcategorySchema = subcategorySchema.extend({ categoryId: categorySchema.shape.name.uuid("Choose a category.") });

export async function createCategory(input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isCategoryPastelColor(color)) return { status: "error", formError: "Choose a category color.", fieldErrors: {} };
  const icon = input.get("icon");
  if (!isCategoryIcon(icon)) return { status: "error", formError: "Choose a category icon.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.rpc("create_category", {
    category_name: parsed.data.name,
    category_kind: parsed.data.kind,
    category_color: color,
    category_icon: icon,
  });
  if (error) return { status: "error", formError: "Unable to save the category. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { status: "success" };
}

export async function updateCategory(categoryId: string, input: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isCategoryPastelColor(color)) return { status: "error", formError: "Choose a category color.", fieldErrors: {} };
  const icon = input.get("icon");
  if (!isCategoryIcon(icon)) return { status: "error", formError: "Choose a category icon.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("categories")
    .update({ name: parsed.data.name, kind: parsed.data.kind, color, icon })
    .eq("id", categoryId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the category. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/categories");
  return { status: "success" };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase.from("categories").delete().eq("id", categoryId).eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the category. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { status: "success" };
}

export async function createSubcategory(categoryId: string, input: FormData): Promise<ActionResult> {
  const parsed = subcategorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isHexColor(color)) return { status: "error", formError: "Choose a subcategory color.", fieldErrors: {} };
  const icon = input.get("icon");
  if (icon && !isCategoryIcon(icon)) return { status: "error", formError: "Choose a subcategory icon.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("subcategories")
    .insert({ household_id: household.householdId, category_id: categoryId, name: parsed.data.name, color, icon: icon || null });
  if (error) return { status: "error", formError: "Unable to save the subcategory. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { status: "success" };
}

export async function updateSubcategory(subcategoryId: string, input: FormData): Promise<ActionResult> {
  const parsed = updateSubcategorySchema.safeParse(Object.fromEntries(input));
  if (!parsed.success) return validationError(parsed.error.issues);
  const color = input.get("color");
  if (!isHexColor(color)) return { status: "error", formError: "Choose a subcategory color.", fieldErrors: {} };
  const icon = input.get("icon");
  if (icon && !isCategoryIcon(icon)) return { status: "error", formError: "Choose a subcategory icon.", fieldErrors: {} };
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("subcategories")
    .update({ category_id: parsed.data.categoryId, name: parsed.data.name, color, icon: icon || null })
    .eq("id", subcategoryId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to update the subcategory. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { status: "success" };
}

export async function deleteSubcategory(subcategoryId: string): Promise<ActionResult> {
  const household = await requireCurrentHousehold();
  const { error } = await household.supabase
    .from("subcategories")
    .delete()
    .eq("id", subcategoryId)
    .eq("household_id", household.householdId);
  if (error) return { status: "error", formError: "Unable to delete the subcategory. Please try again.", fieldErrors: {} };
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { status: "success" };
}
