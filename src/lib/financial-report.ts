export type ReportAccount = {
  id: string;
  name: string;
  kind: "bank" | "credit_card";
  openingBalance: number;
  archivedAt: string | null;
};

export type ReportCategory = {
  id: string;
  name: string;
  kind: "income" | "expense";
  archivedAt: string | null;
};

export type ReportTransaction = {
  id: string;
  kind: "income" | "expense" | "transfer";
  amount: number;
  occurredOn: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  note: string;
  createdAt: string;
  paidBy: string;
};

export type MonthlyReport = {
  bankBalance: number;
  cardDebt: number;
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
  accounts,
  categories,
  transactions,
  month,
  asOfDate = localToday(),
}: {
  accounts: ReportAccount[];
  categories: ReportCategory[];
  transactions: ReportTransaction[];
  month: string;
  asOfDate?: string;
}): MonthlyReport {
  const monthStart = `${month}-01`;
  const monthEnd = nextMonth(month);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalance]));

  for (const transaction of transactions.filter((transaction) => transaction.occurredOn < monthEnd)) {
    const account = accountsById.get(transaction.accountId);
    if (!account) throw new Error(`Unknown account: ${transaction.accountId}`);

    if (transaction.kind === "income") {
      balances.set(account.id, (balances.get(account.id) ?? 0) + transaction.amount);
      continue;
    }

    if (transaction.kind === "expense") {
      const direction = account.kind === "credit_card" ? 1 : -1;
      balances.set(account.id, (balances.get(account.id) ?? 0) + direction * transaction.amount);
      continue;
    }

    const destination = accountsById.get(transaction.destinationAccountId ?? "");
    if (!destination) throw new Error(`Unknown account: ${transaction.destinationAccountId}`);
    balances.set(account.id, (balances.get(account.id) ?? 0) - transaction.amount);
    balances.set(destination.id, (balances.get(destination.id) ?? 0) - transaction.amount);
  }

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
    bankBalance: accounts.filter((account) => account.archivedAt === null && account.kind === "bank").reduce((total, account) => total + (balances.get(account.id) ?? 0), 0),
    cardDebt: accounts.filter((account) => account.archivedAt === null && account.kind === "credit_card").reduce((total, account) => total + (balances.get(account.id) ?? 0), 0),
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
