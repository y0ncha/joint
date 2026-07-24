import { describe, expect, it } from "vitest";

import { categorySchema, partnerAccessSchema, transactionSchema } from "./validation";

describe("transactionSchema", () => {
  const validTransaction = {
    amount: "12.34",
    occurredOn: "2026-07-14",
    categoryId: "food",
    paidBy: "member-id",
    merchant: "Grocer",
    note: "Groceries",
  };

  it("rejects transfers because the visible MVP only supports income and expense", () => {
    expect(() => transactionSchema.parse({
      kind: "transfer",
      amount: "300.00",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "member-id",
      note: "Card payment",
    })).toThrowError("Invalid discriminator value. Expected 'income' | 'expense'");
  });

  it.each(["income", "expense"] as const)("accepts a valid %s transaction", (kind) => {
    expect(transactionSchema.parse({ kind, ...validTransaction })).toMatchObject({ kind, amount: 12.34 });
  });

  it.each([
    ["amount", "12.345", "Use no more than two decimal places."],
    ["occurredOn", "14-07-2026", "Use YYYY-MM-DD."],
    ["categoryId", 1, "Invalid input: expected string, received number"],
    ["paidBy", 1, "Invalid input: expected string, received number"],
    ["merchant", "x".repeat(201), "Use 200 characters or fewer."],
    ["note", "x".repeat(501), "Use 500 characters or fewer."],
  ])("rejects an invalid %s with its existing message", (field, value, message) => {
    const result = transactionSchema.safeParse({ kind: "expense", ...validTransaction, [field]: value });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field], message }));
  });

  it("accepts the merchant and note length boundaries", () => {
    expect(transactionSchema.parse({
      kind: "expense",
      ...validTransaction,
      merchant: "x".repeat(200),
      note: "x".repeat(500),
    })).toMatchObject({ merchant: "x".repeat(200), note: "x".repeat(500) });
  });
});

describe("setup schemas", () => {
  it("rejects a category name longer than 80 characters", () => {
    expect(() => categorySchema.parse({ name: "x".repeat(81), kind: "expense" })).toThrow();
  });

  it("normalizes a valid partner email", () => {
    expect(partnerAccessSchema.parse({ email: " Partner@Example.com " })).toEqual({ email: "partner@example.com" });
  });
});
