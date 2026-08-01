import { epochDayToIsoDate, getIsoMonthRange, isoDateToEpochDay, shiftIsoMonth, type DateRange } from "@/lib/date-range";

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

function toAgorot(amount: number) {
  return Math.round(amount * 100);
}

export function allocateBillDaily(bill: BillInput, displayRange?: DateRange) {
  const serviceStart = isoDateToEpochDay(bill.servicePeriodStart);
  const serviceEnd = isoDateToEpochDay(bill.servicePeriodEnd);
  const firstDay = Math.max(serviceStart, displayRange ? isoDateToEpochDay(displayRange.from) : serviceStart);
  const lastDay = Math.min(serviceEnd, displayRange ? isoDateToEpochDay(displayRange.to) : serviceEnd);
  const totalAgorot = toAgorot(bill.amount);
  const dayCount = serviceEnd - serviceStart + 1;
  const dailyAgorot = Math.floor(totalAgorot / dayCount);
  const remainder = totalAgorot % dayCount;

  return firstDay > lastDay
    ? []
    : Array.from({ length: lastDay - firstDay + 1 }, (_, index) => {
        const day = firstDay + index;
        return {
          date: epochDayToIsoDate(day),
          subcategoryId: bill.subcategoryId,
          agorot: dailyAgorot + (day - serviceStart < remainder ? 1 : 0),
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

export function buildMonthlyRange(period: "rolling" | "calendar", currentDate: string) {
  const currentMonth = epochDayToIsoDate(isoDateToEpochDay(currentDate)).slice(0, 7);
  const firstMonth = period === "rolling" ? shiftIsoMonth(currentMonth, -11) : `${currentMonth.slice(0, 4)}-01`;

  return Array.from({ length: 12 }, (_, index) => shiftIsoMonth(firstMonth, index));
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

export function buildGroceriesDaily(range: DateRange, transactions: GroceryInput[]) {
  const firstDay = isoDateToEpochDay(range.from);
  const lastDay = isoDateToEpochDay(range.to);
  const values = new Map<string, { date: string; mainRunAgorot: number; topUpsAgorot: number }>(
    Array.from({ length: lastDay - firstDay + 1 }, (_, index) => {
      const date = epochDayToIsoDate(firstDay + index);
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
  const groceryRange = params.get("groceryMonth") ? getIsoMonthRange(params.get("groceryMonth")!) : undefined;

  return {
    period: params.get("period") === "calendar" ? ("calendar" as const) : ("rolling" as const),
    billIds:
      billsParam === null
        ? allBillIds
        : selectedBills.length > 0 && selectedBills.every((id) => validBillIds.has(id))
          ? [...new Set(selectedBills)]
          : allBillIds,
    billId: billParam !== null && validBillIds.has(billParam) ? billParam : options.defaultBillId,
    groceryRange: groceryRange ?? getIsoMonthRange(options.currentDate.slice(0, 7))!,
  };
}
