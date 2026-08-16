import { shiftIsoMonth } from "@/lib/date-range";

export type GasTrendRow = {
  bike: number;
  car: number;
  month: string;
  previousBike: number;
  previousCar: number;
  previousTotal: number;
  total: number;
};

export type GasTrend = {
  average: number;
  months: GasTrendRow[];
};

type GasTransaction = {
  amount: number;
  kind: "bike" | "car";
  occurredOn: string;
};

export function buildGasTrend(months: string[], transactions: GasTransaction[]): GasTrend {
  const current = new Map(months.map((month) => [month, { bike: 0, car: 0 }]));
  const previous = new Map(months.map((month) => [shiftIsoMonth(month, -12), { bike: 0, car: 0 }]));

  for (const transaction of transactions) {
    const spending = current.get(transaction.occurredOn.slice(0, 7)) ?? previous.get(transaction.occurredOn.slice(0, 7));
    if (spending) spending[transaction.kind] += transaction.amount;
  }

  const values = months.map((month) => {
    const spending = current.get(month)!;
    const prior = previous.get(shiftIsoMonth(month, -12))!;
    return {
      ...spending,
      month,
      previousBike: prior.bike,
      previousCar: prior.car,
      previousTotal: prior.bike + prior.car,
      total: spending.bike + spending.car,
    };
  });

  return { average: values.reduce((sum, value) => sum + value.total, 0) / values.length, months: values };
}
