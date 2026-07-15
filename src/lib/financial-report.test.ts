import { describe, expect, it } from "vitest";

import { buildMonthlyReport, type ReportAccount, type ReportCategory, type ReportTransaction } from "./financial-report";

const accounts: ReportAccount[] = [
  { id: "bank", name: "Joint bank", kind: "bank", openingBalance: 1_000, archivedAt: null },
  { id: "card", name: "Joint card", kind: "credit_card", openingBalance: 400, archivedAt: null },
];

const categories: ReportCategory[] = [
  { id: "income", name: "Salary", kind: "income", archivedAt: null },
  { id: "food", name: "Food", kind: "expense", archivedAt: null },
];

const transactions: ReportTransaction[] = [
  { id: "income", kind: "income", amount: 500, occurredOn: "2026-07-02", accountId: "bank", destinationAccountId: null, categoryId: "income", note: "Salary", createdAt: "2026-07-02T08:00:00Z", paidBy: "member-id" },
  { id: "bank-expense", kind: "expense", amount: 120, occurredOn: "2026-07-03", accountId: "bank", destinationAccountId: null, categoryId: "food", note: "Groceries", createdAt: "2026-07-03T08:00:00Z", paidBy: "member-id" },
  { id: "transfer", kind: "transfer", amount: 300, occurredOn: "2026-07-04", accountId: "bank", destinationAccountId: "card", categoryId: null, note: "Card payment", createdAt: "2026-07-04T08:00:00Z", paidBy: "member-id" },
  { id: "card-expense", kind: "expense", amount: 250, occurredOn: "2026-07-05", accountId: "card", destinationAccountId: null, categoryId: "food", note: "Restaurant", createdAt: "2026-07-05T08:00:00Z", paidBy: "partner-id" },
  { id: "future", kind: "expense", amount: 99, occurredOn: "2026-08-01", accountId: "bank", destinationAccountId: null, categoryId: "food", note: "Later", createdAt: "2026-08-01T08:00:00Z", paidBy: "member-id" },
];

describe("buildMonthlyReport", () => {
  it("keeps transfers out of July expense and category totals while updating balances", () => {
    expect(buildMonthlyReport({ accounts, categories, transactions, month: "2026-07" })).toMatchObject({
      bankBalance: 1_080,
      cardDebt: 350,
      income: 500,
      expenses: 370,
      expectedMonthlyIncome: null,
      categoryTotals: [{ categoryId: "food", categoryName: "Food", amount: 370 }],
    });
  });

  it("does not include future transactions in a selected month's balances or activity", () => {
    expect(buildMonthlyReport({ accounts, categories, transactions, month: "2026-07" }).recentTransactions.map((transaction) => transaction.id)).toEqual([
      "card-expense",
      "transfer",
      "bank-expense",
      "income",
    ]);
  });

  it("uses the previous three months of income as expected monthly income", () => {
    const transactionsWithRecentIncome: ReportTransaction[] = [
      ...transactions,
      { id: "april-income", kind: "income", amount: 900, occurredOn: "2026-04-20", accountId: "bank", destinationAccountId: null, categoryId: "income", note: "April salary", createdAt: "2026-04-20T08:00:00Z", paidBy: "member-id" },
      { id: "may-income", kind: "income", amount: 1_200, occurredOn: "2026-05-20", accountId: "bank", destinationAccountId: null, categoryId: "income", note: "May salary", createdAt: "2026-05-20T08:00:00Z", paidBy: "member-id" },
      { id: "june-income", kind: "income", amount: 1_500, occurredOn: "2026-06-20", accountId: "bank", destinationAccountId: null, categoryId: "income", note: "June salary", createdAt: "2026-06-20T08:00:00Z", paidBy: "member-id" },
    ];

    expect(buildMonthlyReport({ accounts, categories, transactions: transactionsWithRecentIncome, month: "2026-07" }).expectedMonthlyIncome).toBe(1_200);
  });

  it("reports no expected monthly income when there is no recent income", () => {
    const staleIncome: ReportTransaction[] = [
      { id: "old-income", kind: "income", amount: 900, occurredOn: "2026-03-20", accountId: "bank", destinationAccountId: null, categoryId: "income", note: "Old salary", createdAt: "2026-03-20T08:00:00Z", paidBy: "member-id" },
      { id: "july-expense", kind: "expense", amount: 120, occurredOn: "2026-07-03", accountId: "bank", destinationAccountId: null, categoryId: "food", note: "Groceries", createdAt: "2026-07-03T08:00:00Z", paidBy: "member-id" },
    ];

    expect(buildMonthlyReport({ accounts, categories, transactions: staleIncome, month: "2026-07" }).expectedMonthlyIncome).toBeNull();
  });
});
