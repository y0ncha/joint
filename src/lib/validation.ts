import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const identifierSchema = z.string().trim().min(1, "Select a value.");
const amountSchema = z.coerce
  .number()
  .positive("Enter an amount greater than zero.")
  .refine((amount) => Number.isInteger(amount * 100), "Use no more than two decimal places.");
const noteSchema = z.string().trim().max(500, "Use 500 characters or fewer.");
const nameSchema = z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer.");
const openingBalanceSchema = z.coerce
  .number()
  .nonnegative("Enter zero or a positive amount.")
  .refine((amount) => Number.isInteger(amount * 100), "Use no more than two decimal places.");

const accountFields = {
  name: nameSchema,
  openingBalance: openingBalanceSchema,
  openingBalanceDate: dateSchema,
};

export const accountSchema = z.discriminatedUnion("kind", [
  z.object({ ...accountFields, kind: z.literal("bank") }),
  z.object({
    ...accountFields,
    kind: z.literal("credit_card"),
    lastFourDigits: z.string().regex(/^\d{4}$/, "Enter the last four card digits."),
    statementCloseDay: z.coerce.number().int().min(1, "Use a day from 1 to 31.").max(31, "Use a day from 1 to 31."),
  }),
]);

export const categorySchema = z.object({
  name: nameSchema,
  kind: z.enum(["income", "expense"]),
});

export const invitationSchema = z.object({
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
