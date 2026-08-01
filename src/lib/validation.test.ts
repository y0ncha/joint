import { describe, expect, it } from "vitest";

import { categorySchema, groceriesBudgetSchema, partnerAccessSchema, transactionSchema } from "./validation";

describe("transactionSchema", () => {
  const validTransaction = {
    amount: "12.34",
    occurredOn: "2026-07-14",
    subcategoryId: "groceries",
    paidBy: "member-id",
    merchant: "Grocer",
    note: "Groceries",
  };

  it("rejects transfers because the visible MVP only supports income and expense", () => {
    expect(() =>
      transactionSchema.parse({
        kind: "transfer",
        amount: "300.00",
        occurredOn: "2026-07-14",
        subcategoryId: "groceries",
        paidBy: "member-id",
        note: "Card payment",
      }),
    ).toThrowError("Invalid discriminator value. Expected 'income' | 'expense'");
  });

  it.each(["income", "expense"] as const)("accepts a valid %s transaction", (kind) => {
    expect(transactionSchema.parse({ kind, ...validTransaction })).toMatchObject({ kind, amount: 12.34 });
  });

  it.each(["0.07", "0.29", "1.15"])("accepts the exact two-decimal transaction amount %s", (amount) => {
    expect(transactionSchema.parse({ kind: "expense", ...validTransaction, amount })).toMatchObject({ amount: Number(amount) });
  });

  it.each([
    ["amount", "12.345", "Use no more than two decimal places."],
    ["occurredOn", "14-07-2026", "Use YYYY-MM-DD."],
    ["subcategoryId", 1, "Invalid input: expected string, received number"],
    ["paidBy", 1, "Invalid input: expected string, received number"],
    ["merchant", "x".repeat(201), "Use 200 characters or fewer."],
    ["note", "x".repeat(501), "Use 500 characters or fewer."],
  ])("rejects an invalid %s with its existing message", (field, value, message) => {
    const result = transactionSchema.safeParse({ kind: "expense", ...validTransaction, [field]: value });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field], message }));
  });

  it("accepts the merchant and note length boundaries", () => {
    expect(
      transactionSchema.parse({
        kind: "expense",
        ...validTransaction,
        merchant: "x".repeat(200),
        note: "x".repeat(500),
      }),
    ).toMatchObject({ merchant: "x".repeat(200), note: "x".repeat(500) });
  });

  it.each([
    [{}, {}],
    [
      { servicePeriodStart: "", servicePeriodEnd: "" },
      { servicePeriodStart: null, servicePeriodEnd: null },
    ],
    [
      { servicePeriodStart: "2026-01-01", servicePeriodEnd: "2027-01-01" },
      { servicePeriodStart: "2026-01-01", servicePeriodEnd: "2027-01-01" },
    ],
    [
      { servicePeriodStart: "2024-02-29", servicePeriodEnd: "2024-02-29" },
      { servicePeriodStart: "2024-02-29", servicePeriodEnd: "2024-02-29" },
    ],
  ])("accepts an omitted, empty, or 366-day inclusive service period", (period, expected) => {
    expect(transactionSchema.parse({ kind: "expense", ...validTransaction, ...period })).toMatchObject(expected);
  });

  it.each([
    [{ servicePeriodStart: "2026-07-01" }, "Enter both service period dates."],
    [{ servicePeriodEnd: "2026-07-31" }, "Enter both service period dates."],
    [{ servicePeriodStart: "2026-02-30", servicePeriodEnd: "2026-03-01" }, "Use YYYY-MM-DD."],
    [{ servicePeriodStart: "2026-13-01", servicePeriodEnd: "2026-03-01" }, "Use YYYY-MM-DD."],
    [{ servicePeriodStart: "2026-6-01", servicePeriodEnd: "2026-06-01" }, "Use YYYY-MM-DD."],
    [{ servicePeriodStart: "2026-07-02", servicePeriodEnd: "2026-07-01" }, "End on or after the start date."],
    [{ servicePeriodStart: "2026-01-01", servicePeriodEnd: "2027-01-02" }, "Use 366 days or fewer."],
  ])("rejects an invalid service period", (period, message) => {
    expect(() => transactionSchema.parse({ kind: "expense", ...validTransaction, ...period })).toThrowError(message);
  });

  it("keeps the reversal error alongside an invalid start-date error", () => {
    const result = transactionSchema.safeParse({
      kind: "expense",
      ...validTransaction,
      servicePeriodStart: "2026-13-01",
      servicePeriodEnd: "2026-03-01",
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["servicePeriodStart"], message: "Use YYYY-MM-DD." }),
          expect.objectContaining({ path: ["servicePeriodEnd"], message: "End on or after the start date." }),
        ]),
      );
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

describe("groceriesBudgetSchema", () => {
  it.each([undefined, null, "", "   "])("maps an omitted or empty budget to no budget", (budget) => {
    expect(groceriesBudgetSchema.parse(budget)).toBeNull();
  });

  it.each([
    ["1", 1],
    ["0.07", 0.07],
    ["0.29", 0.29],
    ["1.15", 1.15],
    ["1200.50", 1200.5],
    [9_999_999_999.99, 9_999_999_999.99],
  ])("accepts a positive ILS budget below the database limit", (budget, expected) => {
    expect(groceriesBudgetSchema.parse(budget)).toBe(expected);
  });

  it.each([0, -1, "not-money", "0x10", "1e3", "12.345", Number.NaN, Number.POSITIVE_INFINITY, 10_000_000_000])(
    "rejects an invalid Groceries budget",
    (budget) => {
      expect(groceriesBudgetSchema.safeParse(budget).success).toBe(false);
    },
  );
});
