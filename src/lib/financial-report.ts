import { getIsoMonthRange, inclusiveIsoDayCount, shiftIsoDate, shiftIsoMonth } from "@/lib/date-range";
import type { DateRange } from "@/lib/date-range";

export type ReportCategory = {
  id: string;
  name: string;
  kind: "income" | "expense";
  archivedAt: string | null;
  color?: string;
};

export type ReportSubcategory = {
  id: string;
  name: string;
  categoryId: string;
  color: string;
  icon: string | null;
  archivedAt: string | null;
};

export type ReportTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  categoryId?: string | null;
  subcategoryId: string | null;
  note: string;
  merchant?: string;
  source?: "manual" | "statement_import";
  recurringScheduleId?: string | null;
  recurringScheduleStatus?: "active" | "paused" | "stopped" | "blocked" | null;
  recurrenceCadence?: "weekly" | "monthly" | "custom_weekly" | "custom_monthly" | null;
  recurrenceInterval?: number | null;
  createdAt: string;
  paidBy: string | null;
};

export type MonthlyReport = {
  sharedBalance: number;
  income: number;
  expenses: number;
  incomeChangePercentage: number | null;
  expenseChangePercentage: number | null;
  expectedMonthlyIncome: number | null;
  categoryTotals: Array<{ categoryId: string; categoryName: string; amount: number }>;
  recentTransactions: ReportTransaction[];
};

function dateInMonth(month: string, day: number) {
  const monthEnd = getIsoMonthRange(month)?.to;
  if (!monthEnd) throw new Error(`Invalid ISO month: ${month}`);
  return `${month}-${String(Math.min(day, Number(monthEnd.slice(8)))).padStart(2, "0")}`;
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function percentageChange(value: number, average: number) {
  return average === 0 ? null : ((value - average) / average) * 100;
}

function periodTotals(transactions: ReportTransaction[], from: string, to: string) {
  return transactions.reduce(
    (totals, transaction) => {
      if (transaction.occurredOn < from || transaction.occurredOn > to) return totals;
      if (transaction.kind === "income") totals.income += transaction.amount;
      else totals.expenses += transaction.amount;
      return totals;
    },
    { income: 0, expenses: 0 },
  );
}

function priorPeriods(from: string, to: string, earliestDate: string | undefined) {
  if (!earliestDate) return [];
  const periodDays = inclusiveIsoDayCount(from, to);
  const periods: Array<{ from: string; to: string }> = [];
  let periodEnd = shiftIsoDate(from, -1);

  while (periods.length < 3 && periodEnd >= earliestDate) {
    const periodStart = shiftIsoDate(periodEnd, 1 - periodDays);
    if (periodStart < earliestDate) break;
    periods.push({ from: periodStart, to: periodEnd });
    periodEnd = shiftIsoDate(periodStart, -1);
  }

  return periods;
}

export function buildRangeReport({
  openingBalance,
  categories,
  subcategories,
  transactions,
  from,
  to,
}: {
  openingBalance: number;
  categories: ReportCategory[];
  subcategories: ReportSubcategory[];
  transactions: ReportTransaction[];
} & DateRange): MonthlyReport {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const subcategoriesById = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory]));
  const rangeTransactions = transactions
    .filter((transaction) => transaction.occurredOn >= from && transaction.occurredOn <= to)
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt));
  const { income, expenses } = periodTotals(transactions, from, to);
  const historicalTotals = priorPeriods(from, to, transactions.map((transaction) => transaction.occurredOn).sort()[0]).map((period) =>
    periodTotals(transactions, period.from, period.to),
  );
  const averageIncome = historicalTotals.length
    ? historicalTotals.reduce((total, period) => total + period.income, 0) / historicalTotals.length
    : 0;
  const averageExpenses = historicalTotals.length
    ? historicalTotals.reduce((total, period) => total + period.expenses, 0) / historicalTotals.length
    : 0;
  const categoryTotals = new Map<string, number>();

  for (const transaction of rangeTransactions) {
    if (transaction.kind !== "expense") continue;
    const category = categoriesById.get(transaction.categoryId ?? subcategoriesById.get(transaction.subcategoryId ?? "")?.categoryId ?? "");
    if (!category) continue;
    categoryTotals.set(category.id, (categoryTotals.get(category.id) ?? 0) + transaction.amount);
  }

  return {
    sharedBalance: transactions
      .filter((transaction) => transaction.occurredOn <= to)
      .reduce(
        (balance, transaction) => (transaction.kind === "income" ? balance + transaction.amount : balance - transaction.amount),
        openingBalance,
      ),
    income,
    expenses,
    incomeChangePercentage: historicalTotals.length ? percentageChange(income, averageIncome) : null,
    expenseChangePercentage: historicalTotals.length ? percentageChange(expenses, averageExpenses) : null,
    expectedMonthlyIncome: historicalTotals.length ? averageIncome : null,
    categoryTotals: [...categoryTotals.entries()]
      .map(([categoryId, amount]) => ({ categoryId, categoryName: categoriesById.get(categoryId)?.name ?? "Archived category", amount }))
      .sort((left, right) => right.amount - left.amount || left.categoryName.localeCompare(right.categoryName)),
    recentTransactions: rangeTransactions,
  };
}

export function buildMonthlyReport({
  openingBalance,
  categories,
  subcategories,
  transactions,
  month,
  asOfDate = localToday(),
}: {
  openingBalance: number;
  categories: ReportCategory[];
  subcategories: ReportSubcategory[];
  transactions: ReportTransaction[];
  month: string;
  asOfDate?: string;
}): MonthlyReport {
  const monthStart = `${month}-01`;
  const monthEnd = `${shiftIsoMonth(month, 1)}-01`;
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const subcategoriesById = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory]));
  const sharedBalance = transactions
    .filter((transaction) => transaction.occurredOn < monthEnd)
    .reduce(
      (balance, transaction) => (transaction.kind === "income" ? balance + transaction.amount : balance - transaction.amount),
      openingBalance,
    );

  const monthlyTransactions = transactions
    .filter((transaction) => transaction.occurredOn >= monthStart && transaction.occurredOn < monthEnd)
    .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.createdAt.localeCompare(left.createdAt));
  const isCurrentMonth = asOfDate.slice(0, 7) === month;
  const comparisonDay = Number(asOfDate.slice(8, 10));
  const currentPeriodEnd = isCurrentMonth ? dateInMonth(month, comparisonDay) : null;
  const currentPeriodTransactions = currentPeriodEnd
    ? monthlyTransactions.filter((transaction) => transaction.occurredOn <= currentPeriodEnd)
    : monthlyTransactions;
  const categoryTotals = new Map<string, number>();
  let income = 0;
  let expenses = 0;
  const previousIncomeMonths = Array.from({ length: 3 }, (_, index) => shiftIsoMonth(month, -1 - index));
  const recentIncomeMonths = new Set(previousIncomeMonths);
  const recentIncomeByMonth = new Map<string, number>();

  for (const transaction of currentPeriodTransactions) {
    if (transaction.kind === "income") income += transaction.amount;
    if (transaction.kind !== "expense") continue;

    expenses += transaction.amount;
    const category = categoriesById.get(transaction.categoryId ?? subcategoriesById.get(transaction.subcategoryId ?? "")?.categoryId ?? "");
    if (category) categoryTotals.set(category.id, (categoryTotals.get(category.id) ?? 0) + transaction.amount);
  }

  for (const transaction of transactions) {
    const incomeMonth = transaction.occurredOn.slice(0, 7);
    if (transaction.kind !== "income" || !recentIncomeMonths.has(incomeMonth)) continue;
    recentIncomeByMonth.set(incomeMonth, (recentIncomeByMonth.get(incomeMonth) ?? 0) + transaction.amount);
  }

  const recentIncomeValues = [...recentIncomeByMonth.values()];
  const expectedMonthlyIncome = recentIncomeValues.length
    ? recentIncomeValues.reduce((total, amount) => total + amount, 0) / recentIncomeValues.length
    : null;
  const previousPeriodTotals = previousIncomeMonths.map((previousMonth) => {
    const previousPeriodEnd = dateInMonth(previousMonth, comparisonDay);
    return transactions.reduce(
      (totals, transaction) => {
        if (transaction.occurredOn < `${previousMonth}-01` || transaction.occurredOn > previousPeriodEnd) return totals;
        if (transaction.kind === "income") totals.income += transaction.amount;
        if (transaction.kind === "expense") totals.expenses += transaction.amount;
        return totals;
      },
      { income: 0, expenses: 0 },
    );
  });
  const previousIncomeAverage = previousPeriodTotals.reduce((total, period) => total + period.income, 0) / previousPeriodTotals.length;
  const previousExpenseAverage = previousPeriodTotals.reduce((total, period) => total + period.expenses, 0) / previousPeriodTotals.length;

  return {
    sharedBalance,
    income,
    expenses,
    incomeChangePercentage: isCurrentMonth ? percentageChange(income, previousIncomeAverage) : null,
    expenseChangePercentage: isCurrentMonth ? percentageChange(expenses, previousExpenseAverage) : null,
    expectedMonthlyIncome,
    categoryTotals: [...categoryTotals.entries()]
      .map(([categoryId, amount]) => ({ categoryId, categoryName: categoriesById.get(categoryId)?.name ?? "Archived category", amount }))
      .sort((left, right) => right.amount - left.amount || left.categoryName.localeCompare(right.categoryName)),
    recentTransactions: monthlyTransactions,
  };
}
