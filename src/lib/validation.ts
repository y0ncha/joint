import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const optionalIdentifierSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);
const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || isIsoDate(value), "Use YYYY-MM-DD.");
function hasAtMostTwoDecimalPlaces(amount: number) {
  return Number(amount.toFixed(2)) === amount;
}
const amountSchema = z.coerce
  .number()
  .positive("Enter an amount greater than zero.")
  .refine(hasAtMostTwoDecimalPlaces, "Use no more than two decimal places.");
export const groceriesBudgetSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return /^-?\d+(?:\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}, z.number().finite("Enter a finite amount.").positive("Enter an amount greater than zero.").lt(10_000_000_000, "Enter an amount below 10000000000.").refine(hasAtMostTwoDecimalPlaces, "Use no more than two decimal places.").nullable());
const noteSchema = z.string().trim().max(500, "Use 500 characters or fewer.");
const nameSchema = z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer.");
export const categorySchema = z.object({
  name: nameSchema,
  kind: z.enum(["income", "expense"]),
});

export const partnerAccessSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const transactionSchema = z
  .object({
    kind: z.enum(["income", "expense"], "Invalid discriminator value. Expected 'income' | 'expense'"),
    amount: amountSchema,
    occurredOn: dateSchema,
    servicePeriodStart: optionalDateSchema,
    servicePeriodEnd: optionalDateSchema,
    subcategoryId: optionalIdentifierSchema,
    paidBy: optionalIdentifierSchema,
    merchant: z.string().trim().max(200, "Use 200 characters or fewer.").optional(),
    note: noteSchema,
  })
  .superRefine(({ servicePeriodStart, servicePeriodEnd }, context) => {
    if (Boolean(servicePeriodStart) !== Boolean(servicePeriodEnd)) {
      context.addIssue({ code: "custom", path: ["servicePeriodEnd"], message: "Enter both service period dates." });
      return;
    }
    if (!servicePeriodStart || !servicePeriodEnd) return;
    if (servicePeriodEnd < servicePeriodStart) {
      context.addIssue({ code: "custom", path: ["servicePeriodEnd"], message: "End on or after the start date." });
      return;
    }
    if ((Date.parse(servicePeriodEnd) - Date.parse(servicePeriodStart)) / 86_400_000 + 1 > 366) {
      context.addIssue({ code: "custom", path: ["servicePeriodEnd"], message: "Use 366 days or fewer." });
    }
  });
