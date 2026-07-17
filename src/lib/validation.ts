import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const identifierSchema = z.string().trim().min(1, "Select a value.");
const amountSchema = z.coerce
  .number()
  .positive("Enter an amount greater than zero.")
  .refine((amount) => Number.isInteger(amount * 100), "Use no more than two decimal places.");
const noteSchema = z.string().trim().max(500, "Use 500 characters or fewer.");
const nameSchema = z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer.");
export const categorySchema = z.object({
  name: nameSchema,
  kind: z.enum(["income", "expense"]),
});

export const partnerAccessSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

const incomeSchema = z.object({
  kind: z.literal("income"),
  amount: amountSchema,
  occurredOn: dateSchema,
  categoryId: identifierSchema,
  paidBy: identifierSchema,
  note: noteSchema,
});

const expenseSchema = z.object({
  kind: z.literal("expense"),
  amount: amountSchema,
  occurredOn: dateSchema,
  categoryId: identifierSchema,
  paidBy: identifierSchema,
  note: noteSchema,
});

export const transactionSchema = z.discriminatedUnion("kind", [
  incomeSchema,
  expenseSchema,
]);
