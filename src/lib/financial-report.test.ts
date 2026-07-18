import { describe, expect, it } from "vitest";

import { buildMonthlyReport, type ReportCategory } from "./financial-report";

type TargetReportTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  categoryId: string;
  note: string;
  createdAt: string;
  paidBy: string;
};

const categories: ReportCategory[] = [
  { id: "income", name: "Salary", kind: "income", archivedAt: null },
  { id: "food", name: "Food", kind: "expense", archivedAt: null },
  { id: "home", name: "Home", kind: "expense", archivedAt: null },
];

const transactions: TargetReportTransaction[] = [
  { id: "income", kind: "income", amount: 500, occurredOn: "2026-07-02", categoryId: "income", note: "Salary", createdAt: "2026-07-02T08:00:00Z", paidBy: "member-id" },
  { id: "groceries", kind: "expense", amount: 120, occurredOn: "2026-07-03", categoryId: "food", note: "Groceries", createdAt: "2026-07-03T08:00:00Z", paidBy: "member-id" },
  { id: "restaurant", kind: "expense", amount: 250, occurredOn: "2026-07-05", categoryId: "food", note: "Restaurant", createdAt: "2026-07-05T08:00:00Z", paidBy: "partner-id" },
  { id: "future", kind: "expense", amount: 99, occurredOn: "2026-08-01", categoryId: "food", note: "Later", createdAt: "2026-08-01T08:00:00Z", paidBy: "member-id" },
];

describe("buildMonthlyReport", () => {
  it("calculates one signed shared balance through the selected month cutoff", () => {
    expect(buildMonthlyReport({ openingBalance: -200, categories, transactions, month: "2026-07", asOfDate: "2026-07-16" })).toMatchObject({
      sharedBalance: -70,
      income: 500,
      expenses: 370,
    });
  });

  it("excludes future activity from the selected month and orders recent activity newest first", () => {
    expect(buildMonthlyReport({ openingBalance: 0, categories, transactions, month: "2026-07", asOfDate: "2026-07-16" }).recentTransactions.map((transaction) => transaction.id)).toEqual([
      "restaurant",
      "groceries",
      "income",
    ]);
  });

  it("uses the previous three months of income as expected monthly income", () => {
    const transactionsWithRecentIncome: TargetReportTransaction[] = [
      ...transactions,
      { id: "april-income", kind: "income", amount: 900, occurredOn: "2026-04-20", categoryId: "income", note: "April salary", createdAt: "2026-04-20T08:00:00Z", paidBy: "member-id" },
      { id: "may-income", kind: "income", amount: 1_200, occurredOn: "2026-05-20", categoryId: "income", note: "May salary", createdAt: "2026-05-20T08:00:00Z", paidBy: "member-id" },
      { id: "june-income", kind: "income", amount: 1_500, occurredOn: "2026-06-20", categoryId: "income", note: "June salary", createdAt: "2026-06-20T08:00:00Z", paidBy: "member-id" },
    ];

    expect(buildMonthlyReport({ openingBalance: 0, categories, transactions: transactionsWithRecentIncome, month: "2026-07", asOfDate: "2026-07-16" }).expectedMonthlyIncome).toBe(1_200);
  });

  it("reports no expected monthly income when there is no recent income", () => {
    const staleIncome: TargetReportTransaction[] = [
      { id: "old-income", kind: "income", amount: 900, occurredOn: "2026-03-20", categoryId: "income", note: "Old salary", createdAt: "2026-03-20T08:00:00Z", paidBy: "member-id" },
      { id: "july-expense", kind: "expense", amount: 120, occurredOn: "2026-07-03", categoryId: "food", note: "Groceries", createdAt: "2026-07-03T08:00:00Z", paidBy: "member-id" },
    ];

    expect(buildMonthlyReport({ openingBalance: 0, categories, transactions: staleIncome, month: "2026-07", asOfDate: "2026-07-16" }).expectedMonthlyIncome).toBeNull();
  });

  it("compares this month's progress with prior months through the same capped calendar day", () => {
    const comparisonTransactions: TargetReportTransaction[] = [
      { id: "february-income", kind: "income", amount: 120, occurredOn: "2024-02-29", categoryId: "income", note: "Current", createdAt: "2024-02-29T08:00:00Z", paidBy: "member-id" },
      { id: "february-expense", kind: "expense", amount: 60, occurredOn: "2024-02-29", categoryId: "food", note: "Current", createdAt: "2024-02-29T08:00:00Z", paidBy: "member-id" },
      { id: "january-income-included", kind: "income", amount: 100, occurredOn: "2024-01-29", categoryId: "income", note: "Included", createdAt: "2024-01-29T08:00:00Z", paidBy: "member-id" },
      { id: "january-income-excluded", kind: "income", amount: 200, occurredOn: "2024-01-30", categoryId: "income", note: "Later", createdAt: "2024-01-30T08:00:00Z", paidBy: "member-id" },
      { id: "january-expense-included", kind: "expense", amount: 50, occurredOn: "2024-01-29", categoryId: "food", note: "Included", createdAt: "2024-01-29T08:00:00Z", paidBy: "member-id" },
      { id: "january-expense-excluded", kind: "expense", amount: 50, occurredOn: "2024-01-30", categoryId: "food", note: "Later", createdAt: "2024-01-30T08:00:00Z", paidBy: "member-id" },
      { id: "december-income-included", kind: "income", amount: 140, occurredOn: "2023-12-29", categoryId: "income", note: "Included", createdAt: "2023-12-29T08:00:00Z", paidBy: "member-id" },
      { id: "december-income-excluded", kind: "income", amount: 100, occurredOn: "2023-12-30", categoryId: "income", note: "Later", createdAt: "2023-12-30T08:00:00Z", paidBy: "member-id" },
      { id: "december-expense-included", kind: "expense", amount: 70, occurredOn: "2023-12-29", categoryId: "food", note: "Included", createdAt: "2023-12-29T08:00:00Z", paidBy: "member-id" },
      { id: "november-income", kind: "income", amount: 60, occurredOn: "2023-11-29", categoryId: "income", note: "Included", createdAt: "2023-11-29T08:00:00Z", paidBy: "member-id" },
      { id: "november-expense", kind: "expense", amount: 30, occurredOn: "2023-11-29", categoryId: "food", note: "Included", createdAt: "2023-11-29T08:00:00Z", paidBy: "member-id" },
    ];

    expect(buildMonthlyReport({ openingBalance: 0, categories, transactions: comparisonTransactions, month: "2024-02", asOfDate: "2024-02-29" })).toMatchObject({
      income: 120,
      expenses: 60,
      incomeChangePercentage: 20,
      expenseChangePercentage: 20,
    });
  });

  it("sorts category totals and labels missing categories as archived", () => {
    const report = buildMonthlyReport({
      openingBalance: 0,
      categories,
      transactions: [
        { id: "food", kind: "expense", amount: 100, occurredOn: "2026-07-03", categoryId: "food", note: "Food", createdAt: "2026-07-03T08:00:00Z", paidBy: "member-id" },
        { id: "home", kind: "expense", amount: 100, occurredOn: "2026-07-04", categoryId: "home", note: "Home", createdAt: "2026-07-04T08:00:00Z", paidBy: "member-id" },
        { id: "archived", kind: "expense", amount: 150, occurredOn: "2026-07-05", categoryId: "removed", note: "Old", createdAt: "2026-07-05T08:00:00Z", paidBy: "member-id" },
      ],
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report.categoryTotals).toEqual([
      { categoryId: "removed", categoryName: "Archived category", amount: 150 },
      { categoryId: "food", categoryName: "Food", amount: 100 },
      { categoryId: "home", categoryName: "Home", amount: 100 },
    ]);
  });

  it("does not calculate a percentage against a zero prior average", () => {
    const report = buildMonthlyReport({
      openingBalance: 0,
      categories,
      transactions: [{ id: "current-income", kind: "income", amount: 100, occurredOn: "2026-07-10", categoryId: "income", note: "Current", createdAt: "2026-07-10T08:00:00Z", paidBy: "member-id" }],
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report.incomeChangePercentage).toBeNull();
    expect(report.expenseChangePercentage).toBeNull();
  });
});
