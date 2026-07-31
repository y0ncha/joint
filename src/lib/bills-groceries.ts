type IsoDateRange = { from: string; to: string };

type BillInput = {
  amount: number;
  subcategoryId: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
};

type GroceryInput = {
  amount: number;
  occurredOn: string;
  subcategoryKey: "main_run" | "top_ups";
};

const DAY_MS = 86_400_000;

function isoDay(value: string) {
  const day = Date.parse(`${value}T00:00:00Z`) / DAY_MS;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(day * DAY_MS).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return day;
}

function dayIso(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function toAgorot(amount: number) {
  return Math.round(amount * 100);
}

export function allocateBillDaily(bill: BillInput, displayRange?: IsoDateRange) {
  const serviceStart = isoDay(bill.servicePeriodStart);
  const serviceEnd = isoDay(bill.servicePeriodEnd);
  const firstDay = Math.max(serviceStart, displayRange ? isoDay(displayRange.from) : serviceStart);
  const lastDay = Math.min(serviceEnd, displayRange ? isoDay(displayRange.to) : serviceEnd);
  const totalAgorot = BigInt(toAgorot(bill.amount));
  const dayCount = BigInt(serviceEnd - serviceStart + 1);
  const dailyAgorot = totalAgorot / dayCount;
  const remainder = totalAgorot % dayCount;

  return firstDay > lastDay
    ? []
    : Array.from({ length: lastDay - firstDay + 1 }, (_, index) => {
        const day = firstDay + index;
        return {
          date: dayIso(day),
          subcategoryId: bill.subcategoryId,
          agorot: Number(dailyAgorot + (BigInt(day - serviceStart) < remainder ? 1n : 0n)),
        };
      });
}

export function consolidateBillsByMonth(allocations: ReturnType<typeof allocateBillDaily>) {
  const totals = new Map<string, Map<string, number>>();

  for (const allocation of allocations) {
    const month = allocation.date.slice(0, 7);
    const monthTotals = totals.get(month) ?? new Map<string, number>();
    monthTotals.set(allocation.subcategoryId, (monthTotals.get(allocation.subcategoryId) ?? 0) + allocation.agorot);
    totals.set(month, monthTotals);
  }

  return [...totals]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([month, monthTotals]) =>
      [...monthTotals]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([subcategoryId, agorot]) => ({ month, subcategoryId, agorot })),
    );
}

function monthIso(monthIndex: number) {
  const year = Math.floor(monthIndex / 12);
  return `${year}-${String((monthIndex % 12) + 1).padStart(2, "0")}`;
}

export function buildMonthlyRange(period: "rolling" | "calendar", currentDate: string) {
  const current = new Date(isoDay(currentDate) * DAY_MS);
  const currentMonth = current.getUTCFullYear() * 12 + current.getUTCMonth();
  const firstMonth = period === "rolling" ? currentMonth - 11 : current.getUTCFullYear() * 12;

  return Array.from({ length: 12 }, (_, index) => monthIso(firstMonth + index));
}

export function alignBillYearOverYear(months: string[], monthly: ReturnType<typeof consolidateBillsByMonth>, subcategoryId: string) {
  const values = new Map(monthly.filter((value) => value.subcategoryId === subcategoryId).map((value) => [value.month, value.agorot]));

  return months.map((month) => {
    const previousMonth = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
    const previousAgorot = values.get(previousMonth);
    return {
      month,
      currentAgorot: values.get(month) ?? 0,
      ...(previousAgorot === undefined ? {} : { previousAgorot }),
    };
  });
}

export function pickDefaultBillSubcategory(
  months: string[],
  bills: Array<{ id: string; name: string }>,
  monthly: ReturnType<typeof consolidateBillsByMonth>,
) {
  const displayedMonths = new Set(months);
  const totals = new Map<string, number>();

  for (const value of monthly) {
    if (displayedMonths.has(value.month)) {
      totals.set(value.subcategoryId, (totals.get(value.subcategoryId) ?? 0) + value.agorot);
    }
  }

  return (
    [...bills].sort((left, right) => {
      const totalDifference = (totals.get(right.id) ?? 0) - (totals.get(left.id) ?? 0);
      if (totalDifference !== 0) return totalDifference;
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      if (leftName !== rightName) return leftName < rightName ? -1 : 1;
      return left.id.localeCompare(right.id);
    })[0]?.id ?? null
  );
}

export function buildGroceriesMonthly(months: string[], transactions: GroceryInput[], monthlyBudget: number | null) {
  const values = new Map<string, { month: string; mainRunAgorot: number; topUpsAgorot: number }>(
    months.map((month) => [month, { month, mainRunAgorot: 0, topUpsAgorot: 0 }]),
  );

  for (const transaction of transactions) {
    const value = values.get(transaction.occurredOn.slice(0, 7));
    if (!value) continue;
    const agorot = toAgorot(transaction.amount);
    if (transaction.subcategoryKey === "main_run") value.mainRunAgorot += agorot;
    else value.topUpsAgorot += agorot;
  }

  return {
    budgetAgorot: monthlyBudget === null ? null : toAgorot(monthlyBudget),
    months: months.map((month) => values.get(month)!),
  };
}

export function buildGroceriesDaily(range: IsoDateRange, transactions: GroceryInput[]) {
  const firstDay = isoDay(range.from);
  const lastDay = isoDay(range.to);
  const values = new Map<string, { date: string; mainRunAgorot: number; topUpsAgorot: number }>(
    Array.from({ length: lastDay - firstDay + 1 }, (_, index) => {
      const date = dayIso(firstDay + index);
      return [date, { date, mainRunAgorot: 0, topUpsAgorot: 0 }];
    }),
  );

  for (const transaction of transactions) {
    const value = values.get(transaction.occurredOn);
    if (!value) continue;
    const agorot = toAgorot(transaction.amount);
    if (transaction.subcategoryKey === "main_run") value.mainRunAgorot += agorot;
    else value.topUpsAgorot += agorot;
  }

  return [...values.values()].map((value) => ({
    ...value,
    totalAgorot: value.mainRunAgorot + value.topUpsAgorot,
  }));
}

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const monthIndex = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
  return { from: `${month}-01`, to: dayIso(Date.UTC(Math.floor((monthIndex + 1) / 12), (monthIndex + 1) % 12) / DAY_MS - 1) };
}

export function parseBillsGroceriesUrlDefaults(
  params: { get(name: string): string | null },
  options: {
    bills: Array<{ id: string; name: string }>;
    defaultBillId: string | null;
    currentDate: string;
  },
) {
  const allBillIds = options.bills.map((bill) => bill.id);
  const validBillIds = new Set(allBillIds);
  const billsParam = params.get("bills");
  const selectedBills = billsParam?.split(",") ?? [];
  const billParam = params.get("bill");
  const groceryRange = params.get("groceryMonth") ? monthRange(params.get("groceryMonth")!) : null;

  return {
    period: params.get("period") === "calendar" ? ("calendar" as const) : ("rolling" as const),
    billIds:
      billsParam === null
        ? allBillIds
        : selectedBills.length > 0 && selectedBills.every((id) => validBillIds.has(id))
          ? [...new Set(selectedBills)]
          : allBillIds,
    billId: billParam !== null && validBillIds.has(billParam) ? billParam : options.defaultBillId,
    groceryRange: groceryRange ?? monthRange(options.currentDate.slice(0, 7))!,
  };
}
