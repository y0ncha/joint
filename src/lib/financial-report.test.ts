import { describe, expect, it } from "vitest";

import {
  buildMonthlyReport,
  buildRangeReport,
  type ReportCategory,
  type ReportSubcategory,
  type ReportTransaction,
} from "./financial-report";

const categories: ReportCategory[] = [
  { id: "income", name: "Salary", kind: "income", archivedAt: null },
  { id: "food", name: "Food", kind: "expense", archivedAt: null },
  { id: "home", name: "Bills", kind: "expense", archivedAt: null },
  { id: "archived", name: "Archived parent", kind: "expense", archivedAt: "2026-06-01T00:00:00Z" },
];

const subcategories: ReportSubcategory[] = [
  { id: "salary", name: "Salary", categoryId: "income", color: "#dcece3", icon: null, archivedAt: null },
  { id: "groceries", name: "Groceries", categoryId: "food", color: "#c5e8f7", icon: null, archivedAt: null },
  { id: "restaurants", name: "Restaurants", categoryId: "food", color: "#f8d7d7", icon: null, archivedAt: null },
  { id: "housing", name: "Electricity", categoryId: "home", color: "#efeffc", icon: null, archivedAt: null },
  {
    id: "archived-child",
    name: "Archived child",
    categoryId: "archived",
    color: "#ffeee6",
    icon: null,
    archivedAt: "2026-06-01T00:00:00Z",
  },
];

const transactions: Array<ReportTransaction & { servicePeriodStart?: string | null; servicePeriodEnd?: string | null }> = [
  {
    id: "income",
    kind: "income",
    amount: 500,
    occurredOn: "2026-07-02",
    subcategoryId: "salary",
    note: "Salary",
    createdAt: "2026-07-02T08:00:00Z",
    paidBy: "member-id",
  },
  {
    id: "groceries",
    kind: "expense",
    amount: 120,
    occurredOn: "2026-07-03",
    subcategoryId: "groceries",
    note: "Groceries",
    createdAt: "2026-07-03T08:00:00Z",
    paidBy: "member-id",
  },
  {
    id: "restaurant",
    kind: "expense",
    amount: 250,
    occurredOn: "2026-07-05",
    subcategoryId: "restaurants",
    note: "Restaurant",
    createdAt: "2026-07-05T08:00:00Z",
    paidBy: "partner-id",
  },
  {
    id: "future",
    kind: "expense",
    amount: 99,
    occurredOn: "2026-08-01",
    servicePeriodStart: "2026-07-15",
    servicePeriodEnd: "2026-09-15",
    subcategoryId: "housing",
    note: "Electricity bill",
    createdAt: "2026-08-01T08:00:00Z",
    paidBy: "member-id",
  },
];

describe("buildMonthlyReport", () => {
  it("calculates one signed shared balance through the selected month cutoff", () => {
    const report = buildMonthlyReport({
      openingBalance: -200,
      categories,
      subcategories,
      transactions,
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report).toMatchObject({
      sharedBalance: -70,
      income: 500,
      expenses: 370,
    });
    expect(report.categoryTotals).toEqual([{ categoryId: "food", categoryName: "Food", amount: 370 }]);
  });

  it("excludes future activity from the selected month and orders recent activity newest first", () => {
    expect(
      buildMonthlyReport({
        openingBalance: 0,
        categories,
        subcategories,
        transactions,
        month: "2026-07",
        asOfDate: "2026-07-16",
      }).recentTransactions.map((transaction) => transaction.id),
    ).toEqual(["restaurant", "groceries", "income"]);
  });

  it("keeps Bills service periods out of monthly and custom-range ledger and shared-balance calculations", () => {
    const julyMonthly = buildMonthlyReport({
      openingBalance: -200,
      categories,
      subcategories,
      transactions,
      month: "2026-07",
      asOfDate: "2026-07-16",
    });
    const augustMonthly = buildMonthlyReport({
      openingBalance: -200,
      categories,
      subcategories,
      transactions,
      month: "2026-08",
      asOfDate: "2026-08-16",
    });
    const julyRange = buildRangeReport({
      openingBalance: -200,
      categories,
      subcategories,
      transactions,
      from: "2026-07-01",
      to: "2026-07-31",
    });
    const augustRange = buildRangeReport({
      openingBalance: -200,
      categories,
      subcategories,
      transactions,
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(julyMonthly).toMatchObject({ sharedBalance: -70, income: 500, expenses: 370 });
    expect(julyMonthly.recentTransactions.map((transaction) => transaction.id)).not.toContain("future");
    expect(augustMonthly).toMatchObject({ sharedBalance: -169, income: 0, expenses: 99 });
    expect(augustMonthly.categoryTotals).toEqual([{ categoryId: "home", categoryName: "Bills", amount: 99 }]);
    expect(augustMonthly.recentTransactions).toEqual([
      expect.objectContaining({
        id: "future",
        amount: 99,
        occurredOn: "2026-08-01",
        servicePeriodStart: "2026-07-15",
        servicePeriodEnd: "2026-09-15",
      }),
    ]);
    expect(julyRange).toMatchObject({ sharedBalance: -70, income: 500, expenses: 370 });
    expect(julyRange.recentTransactions.map((transaction) => transaction.id)).not.toContain("future");
    expect(augustRange).toMatchObject({ sharedBalance: -169, income: 0, expenses: 99 });
    expect(augustRange.categoryTotals).toEqual([{ categoryId: "home", categoryName: "Bills", amount: 99 }]);
    expect(augustRange.recentTransactions).toEqual(augustMonthly.recentTransactions);
  });

  it("uses the previous three months of income as expected monthly income", () => {
    const transactionsWithRecentIncome: ReportTransaction[] = [
      ...transactions,
      {
        id: "april-income",
        kind: "income",
        amount: 900,
        occurredOn: "2026-04-20",
        subcategoryId: "salary",
        note: "April salary",
        createdAt: "2026-04-20T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "may-income",
        kind: "income",
        amount: 1_200,
        occurredOn: "2026-05-20",
        subcategoryId: "salary",
        note: "May salary",
        createdAt: "2026-05-20T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "june-income",
        kind: "income",
        amount: 1_500,
        occurredOn: "2026-06-20",
        subcategoryId: "salary",
        note: "June salary",
        createdAt: "2026-06-20T08:00:00Z",
        paidBy: "member-id",
      },
    ];

    expect(
      buildMonthlyReport({
        openingBalance: 0,
        categories,
        subcategories,
        transactions: transactionsWithRecentIncome,
        month: "2026-07",
        asOfDate: "2026-07-16",
      }).expectedMonthlyIncome,
    ).toBe(1_200);
  });

  it("reports no expected monthly income when there is no recent income", () => {
    const staleIncome: ReportTransaction[] = [
      {
        id: "old-income",
        kind: "income",
        amount: 900,
        occurredOn: "2026-03-20",
        subcategoryId: "salary",
        note: "Old salary",
        createdAt: "2026-03-20T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "july-expense",
        kind: "expense",
        amount: 120,
        occurredOn: "2026-07-03",
        subcategoryId: "groceries",
        note: "Groceries",
        createdAt: "2026-07-03T08:00:00Z",
        paidBy: "member-id",
      },
    ];

    expect(
      buildMonthlyReport({
        openingBalance: 0,
        categories,
        subcategories,
        transactions: staleIncome,
        month: "2026-07",
        asOfDate: "2026-07-16",
      }).expectedMonthlyIncome,
    ).toBeNull();
  });

  it("compares this month's progress with prior months through the same capped calendar day", () => {
    const comparisonTransactions: ReportTransaction[] = [
      {
        id: "february-income",
        kind: "income",
        amount: 120,
        occurredOn: "2024-02-29",
        subcategoryId: "salary",
        note: "Current",
        createdAt: "2024-02-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "february-expense",
        kind: "expense",
        amount: 60,
        occurredOn: "2024-02-29",
        subcategoryId: "groceries",
        note: "Current",
        createdAt: "2024-02-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "january-income-included",
        kind: "income",
        amount: 100,
        occurredOn: "2024-01-29",
        subcategoryId: "salary",
        note: "Included",
        createdAt: "2024-01-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "january-income-excluded",
        kind: "income",
        amount: 200,
        occurredOn: "2024-01-30",
        subcategoryId: "salary",
        note: "Later",
        createdAt: "2024-01-30T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "january-expense-included",
        kind: "expense",
        amount: 50,
        occurredOn: "2024-01-29",
        subcategoryId: "groceries",
        note: "Included",
        createdAt: "2024-01-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "january-expense-excluded",
        kind: "expense",
        amount: 50,
        occurredOn: "2024-01-30",
        subcategoryId: "groceries",
        note: "Later",
        createdAt: "2024-01-30T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "december-income-included",
        kind: "income",
        amount: 140,
        occurredOn: "2023-12-29",
        subcategoryId: "salary",
        note: "Included",
        createdAt: "2023-12-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "december-income-excluded",
        kind: "income",
        amount: 100,
        occurredOn: "2023-12-30",
        subcategoryId: "salary",
        note: "Later",
        createdAt: "2023-12-30T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "december-expense-included",
        kind: "expense",
        amount: 70,
        occurredOn: "2023-12-29",
        subcategoryId: "groceries",
        note: "Included",
        createdAt: "2023-12-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "november-income",
        kind: "income",
        amount: 60,
        occurredOn: "2023-11-29",
        subcategoryId: "salary",
        note: "Included",
        createdAt: "2023-11-29T08:00:00Z",
        paidBy: "member-id",
      },
      {
        id: "november-expense",
        kind: "expense",
        amount: 30,
        occurredOn: "2023-11-29",
        subcategoryId: "groceries",
        note: "Included",
        createdAt: "2023-11-29T08:00:00Z",
        paidBy: "member-id",
      },
    ];

    expect(
      buildMonthlyReport({
        openingBalance: 0,
        categories,
        subcategories,
        transactions: comparisonTransactions,
        month: "2024-02",
        asOfDate: "2024-02-29",
      }),
    ).toMatchObject({
      income: 120,
      expenses: 60,
      incomeChangePercentage: 20,
      expenseChangePercentage: 20,
    });
  });

  it("caps a March 31 comparison at February's leap-day month end", () => {
    const report = buildMonthlyReport({
      openingBalance: 0,
      categories,
      subcategories,
      transactions: [
        {
          id: "march-income",
          kind: "income",
          amount: 120,
          occurredOn: "2024-03-31",
          subcategoryId: "salary",
          note: "Current",
          createdAt: "2024-03-31T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "february-income-included",
          kind: "income",
          amount: 100,
          occurredOn: "2024-02-29",
          subcategoryId: "salary",
          note: "Included",
          createdAt: "2024-02-29T08:00:00Z",
          paidBy: "member-id",
        },
      ],
      month: "2024-03",
      asOfDate: "2024-03-31",
    });

    expect(report.incomeChangePercentage).toBeCloseTo(260);
  });

  it("sorts parent totals, keeps loaded archived hierarchy, and excludes missing hierarchy", () => {
    const report = buildMonthlyReport({
      openingBalance: 0,
      categories,
      subcategories,
      transactions: [
        {
          id: "food",
          kind: "expense",
          amount: 100,
          occurredOn: "2026-07-03",
          subcategoryId: "groceries",
          note: "Food",
          createdAt: "2026-07-03T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "home",
          kind: "expense",
          amount: 100,
          occurredOn: "2026-07-04",
          subcategoryId: "housing",
          note: "Home",
          createdAt: "2026-07-04T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "archived",
          kind: "expense",
          amount: 150,
          occurredOn: "2026-07-05",
          subcategoryId: "archived-child",
          note: "Old",
          createdAt: "2026-07-05T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "missing",
          kind: "expense",
          amount: 200,
          occurredOn: "2026-07-06",
          subcategoryId: "missing",
          note: "Missing hierarchy",
          createdAt: "2026-07-06T08:00:00Z",
          paidBy: "member-id",
        },
      ],
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report.categoryTotals).toEqual([
      { categoryId: "archived", categoryName: "Archived parent", amount: 150 },
      { categoryId: "home", categoryName: "Bills", amount: 100 },
      { categoryId: "food", categoryName: "Food", amount: 100 },
    ]);
  });

  it("includes uncategorized imported expenses in household totals but not category totals", () => {
    const report = buildMonthlyReport({
      openingBalance: 500,
      categories,
      subcategories,
      transactions: [
        {
          id: "groceries",
          kind: "expense",
          amount: 100,
          occurredOn: "2026-07-03",
          subcategoryId: "groceries",
          note: "Groceries",
          createdAt: "2026-07-03T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "imported",
          kind: "expense",
          amount: 80,
          occurredOn: "2026-07-04",
          subcategoryId: null,
          note: "Statement note",
          createdAt: "2026-07-04T08:00:00Z",
          paidBy: null,
        },
      ],
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report).toMatchObject({ sharedBalance: 320, expenses: 180 });
    expect(report.categoryTotals).toEqual([{ categoryId: "food", categoryName: "Food", amount: 100 }]);
  });

  it("does not calculate a percentage against a zero prior average", () => {
    const report = buildMonthlyReport({
      openingBalance: 0,
      categories,
      subcategories,
      transactions: [
        {
          id: "current-income",
          kind: "income",
          amount: 100,
          occurredOn: "2026-07-10",
          subcategoryId: "salary",
          note: "Current",
          createdAt: "2026-07-10T08:00:00Z",
          paidBy: "member-id",
        },
      ],
      month: "2026-07",
      asOfDate: "2026-07-16",
    });

    expect(report.incomeChangePercentage).toBeNull();
    expect(report.expenseChangePercentage).toBeNull();
  });
});

describe("buildRangeReport", () => {
  it("uses only complete equal-length prior ranges for comparisons", () => {
    const report = buildRangeReport({
      openingBalance: 0,
      categories,
      subcategories,
      transactions: [
        {
          id: "oldest-income",
          kind: "income",
          amount: 30,
          occurredOn: "2026-07-05",
          subcategoryId: "salary",
          note: "Oldest",
          createdAt: "2026-07-05T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "oldest-expense",
          kind: "expense",
          amount: 10,
          occurredOn: "2026-07-05",
          subcategoryId: "groceries",
          note: "Oldest",
          createdAt: "2026-07-05T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "second-income",
          kind: "income",
          amount: 70,
          occurredOn: "2026-07-06",
          subcategoryId: "salary",
          note: "Second",
          createdAt: "2026-07-06T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "second-expense",
          kind: "expense",
          amount: 30,
          occurredOn: "2026-07-07",
          subcategoryId: "groceries",
          note: "Second",
          createdAt: "2026-07-07T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "first-income",
          kind: "income",
          amount: 50,
          occurredOn: "2026-07-08",
          subcategoryId: "salary",
          note: "First",
          createdAt: "2026-07-08T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "first-expense",
          kind: "expense",
          amount: 20,
          occurredOn: "2026-07-09",
          subcategoryId: "groceries",
          note: "First",
          createdAt: "2026-07-09T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "range-income",
          kind: "income",
          amount: 100,
          occurredOn: "2026-07-10",
          subcategoryId: "salary",
          note: "Range",
          createdAt: "2026-07-10T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "range-expense",
          kind: "expense",
          amount: 40,
          occurredOn: "2026-07-11",
          subcategoryId: "groceries",
          note: "Range",
          createdAt: "2026-07-11T08:00:00Z",
          paidBy: "member-id",
        },
      ],
      from: "2026-07-10",
      to: "2026-07-11",
    });

    expect(report).toMatchObject({ income: 100, expenses: 40, sharedBalance: 150, expectedMonthlyIncome: 60 });
    expect(report.incomeChangePercentage).toBeCloseTo(66.666, 2);
    expect(report.expenseChangePercentage).toBe(60);
    expect(report.categoryTotals).toEqual([{ categoryId: "food", categoryName: "Food", amount: 40 }]);
    expect(report.recentTransactions.map((transaction) => transaction.id)).toEqual(["range-expense", "range-income"]);
  });

  it("does not compare against an incomplete earlier range", () => {
    const report = buildRangeReport({
      openingBalance: 0,
      categories,
      subcategories,
      transactions: [
        {
          id: "earlier-income",
          kind: "income",
          amount: 30,
          occurredOn: "2026-07-09",
          subcategoryId: "salary",
          note: "Earlier",
          createdAt: "2026-07-09T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "range-income",
          kind: "income",
          amount: 100,
          occurredOn: "2026-07-10",
          subcategoryId: "salary",
          note: "Range",
          createdAt: "2026-07-10T08:00:00Z",
          paidBy: "member-id",
        },
        {
          id: "range-expense",
          kind: "expense",
          amount: 40,
          occurredOn: "2026-07-11",
          subcategoryId: "groceries",
          note: "Range",
          createdAt: "2026-07-11T08:00:00Z",
          paidBy: "member-id",
        },
      ],
      from: "2026-07-10",
      to: "2026-07-11",
    });

    expect(report).toMatchObject({ expectedMonthlyIncome: null, incomeChangePercentage: null, expenseChangePercentage: null });
  });
});
