import { describe, expect, it } from "vitest";

import {
  calculateHouseholdBalances,
  type Account,
  type Transaction,
} from "./account-balances";

const accounts: Account[] = [
  { id: "bank", kind: "bank", openingBalance: 1_000 },
  { id: "card", kind: "credit_card", openingBalance: 400 },
];

const transactions: Transaction[] = [
  { type: "income", accountId: "bank", amount: 500 },
  { type: "expense", accountId: "bank", amount: 120 },
  {
    type: "transfer",
    sourceAccountId: "bank",
    destinationAccountId: "card",
    amount: 300,
  },
  { type: "expense", accountId: "card", amount: 250 },
];

describe("calculateHouseholdBalances", () => {
  it("calculates bank balance and credit-card debt from positive amounts", () => {
    const result = calculateHouseholdBalances(accounts, transactions);

    expect(result.accounts).toEqual([
      { accountId: "bank", balance: 1_080 },
      { accountId: "card", balance: 350 },
    ]);
  });

  it("excludes transfers from expense totals", () => {
    const result = calculateHouseholdBalances(accounts, transactions);

    expect(result.totalExpenses).toBe(370);
  });

  it("rejects transfers that do not pay a credit card from the bank", () => {
    expect(() =>
      calculateHouseholdBalances(accounts, [
        {
          type: "transfer",
          sourceAccountId: "card",
          destinationAccountId: "bank",
          amount: 300,
        },
      ]),
    ).toThrow();
  });

  it("rejects a transaction that references an unknown account", () => {
    expect(() =>
      calculateHouseholdBalances(accounts, [
        { type: "expense", accountId: "missing", amount: 120 },
      ]),
    ).toThrow();
  });

  it("rejects income recorded against a credit card", () => {
    expect(() =>
      calculateHouseholdBalances(accounts, [
        { type: "income", accountId: "card", amount: 500 },
      ]),
    ).toThrow();
  });
});
