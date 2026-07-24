export type ReportCategory = {
  id: string;
  name: string;
  kind: "income" | "expense";
  archivedAt: string | null;
  color?: string;
};

export type ReportTransaction = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  occurredOn: string;
  categoryId: string | null;
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

export function buildMonthlyReport({
  openingBalance,
  categories,
  transactions,
  month,
  asOfDate = localToday(),
}: {
  openingBalance: number;
  categories: ReportCategory[];
  transactions: ReportTransaction[];
  month: string;
  asOfDate?: string;
}): MonthlyReport {
  const monthStart = `${month}-01`;
  const monthEnd = nextMonth(month);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const sharedBalance = transactions
    .filter((transaction) => transaction.occurredOn < monthEnd)
    .reduce((balance, transaction) => transaction.kind === "income" ? balance + transaction.amount : balance - transaction.amount, openingBalance);

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
    if (transaction.categoryId) {
      categoryTotals.set(transaction.categoryId, (categoryTotals.get(transaction.categoryId) ?? 0) + transaction.amount);
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
    return transactions.reduce((totals, transaction) => {
      if (transaction.occurredOn < `${previousMonth}-01` || transaction.occurredOn > previousPeriodEnd) return totals;
      if (transaction.kind === "income") totals.income += transaction.amount;
      if (transaction.kind === "expense") totals.expenses += transaction.amount;
      return totals;
    }, { income: 0, expenses: 0 });
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
