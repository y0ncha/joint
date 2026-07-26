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
  color?: string;
  icon?: string | null;
  archivedAt: string | null;
};

export type ReportTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  subcategoryId: string | null;
  note: string;
  merchant?: string;
  source?: "manual" | "statement_import";
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

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 10);
}

function previousMonths(month: string, count: number) {
  const [year, monthNumber] = month.split("-").map(Number);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 2 - index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dateInMonth(month: string, day: number) {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function percentageChange(value: number, average: number) {
  return average === 0 ? null : ((value - average) / average) * 100;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  const periodDays = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  const periods: Array<{ from: string; to: string }> = [];
  let periodEnd = shiftDate(from, -1);

  while (periods.length < 3 && periodEnd >= earliestDate) {
    const periodStart = shiftDate(periodEnd, 1 - periodDays);
    if (periodStart < earliestDate) break;
    periods.push({ from: periodStart, to: periodEnd });
    periodEnd = shiftDate(periodStart, -1);
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
    if (transaction.kind !== "expense" || !transaction.subcategoryId) continue;
    const category = categoriesById.get(subcategoriesById.get(transaction.subcategoryId)?.categoryId ?? "");
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
  const monthEnd = nextMonth(month);
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
  const recentIncomeMonths = new Set(previousMonths(month, 3));
  const recentIncomeByMonth = new Map<string, number>();

  for (const transaction of currentPeriodTransactions) {
    if (transaction.kind === "income") income += transaction.amount;
    if (transaction.kind !== "expense") continue;

    expenses += transaction.amount;
    if (transaction.subcategoryId) {
      const category = categoriesById.get(subcategoriesById.get(transaction.subcategoryId)?.categoryId ?? "");
      if (category) categoryTotals.set(category.id, (categoryTotals.get(category.id) ?? 0) + transaction.amount);
    }
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
  const previousPeriodTotals = previousMonths(month, 3).map((previousMonth) => {
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
import type { DateRange } from "@/lib/date-range";
