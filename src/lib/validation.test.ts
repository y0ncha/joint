import { describe, expect, it } from "vitest";

import { accountSchema, categorySchema, invitationSchema, transactionSchema } from "./validation";

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
  it("accepts the internal shared-balance setup account shape", () => {
    expect(accountSchema.parse({ name: "Shared balance", kind: "bank", openingBalance: "1.00", openingBalanceDate: "2026-07-01" })).toMatchObject({ kind: "bank", openingBalance: 1 });
  });

  it("requires display-only card details for credit cards", () => {
    expect(accountSchema.parse({ name: "Visa", kind: "credit_card", openingBalance: "0", openingBalanceDate: "2026-07-01", lastFourDigits: "1234", statementCloseDay: "10" })).toMatchObject({ lastFourDigits: "1234", statementCloseDay: 10 });
    expect(() => accountSchema.parse({ name: "Visa", kind: "credit_card", openingBalance: "0", openingBalanceDate: "2026-07-01", lastFourDigits: "123", statementCloseDay: "32" })).toThrow();
  });

  it("rejects an account opening balance with fractional cents", () => {
    expect(() => accountSchema.parse({ name: "Bank", kind: "bank", openingBalance: "1.001", openingBalanceDate: "2026-07-01" })).toThrow();
  });

  it("rejects a category name longer than 80 characters", () => {
    expect(() => categorySchema.parse({ name: "x".repeat(81), kind: "expense" })).toThrow();
  });

  it("normalizes a valid invitation email", () => {
    expect(invitationSchema.parse({ email: " Partner@Example.com " })).toEqual({ email: "partner@example.com" });
  });
});
