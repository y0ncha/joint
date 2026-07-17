import { describe, expect, it } from "vitest";

import { categorySchema, partnerAccessSchema, transactionSchema } from "./validation";

describe("transactionSchema", () => {
  it("rejects transfers because the visible MVP only supports income and expense", () => {
    expect(() => transactionSchema.parse({
      kind: "transfer",
      amount: "300.00",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "member-id",
      note: "Card payment",
    })).toThrow();
  });

  it("accepts an expense without a submitted account id", () => {
    expect(transactionSchema.parse({
      kind: "expense",
      amount: "12.34",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "member-id",
      note: "Groceries",
    })).toMatchObject({ kind: "expense", amount: 12.34 });
  });

  it("rejects an amount with more than two decimal places", () => {
    expect(() => transactionSchema.parse({
      kind: "expense",
      amount: "12.345",
      occurredOn: "2026-07-14",
      categoryId: "food",
      paidBy: "member-id",
      note: "Groceries",
    })).toThrow();
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
