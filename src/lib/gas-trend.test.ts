import { expect, it } from "vitest";

import { buildGasTrend } from "./gas-trend";

it("aligns Bike and Car spending with the same months from the previous year", () => {
  expect(
    buildGasTrend(
      ["2026-01", "2026-02", "2026-03"],
      [
        { amount: 10, kind: "bike", occurredOn: "2025-01-20" },
        { amount: 20, kind: "car", occurredOn: "2025-01-21" },
        { amount: 30, kind: "car", occurredOn: "2026-02-01" },
        { amount: 40, kind: "bike", occurredOn: "2026-03-01" },
        { amount: 50, kind: "car", occurredOn: "2026-03-02" },
      ],
    ),
  ).toEqual({
    average: 40,
    months: [
      { bike: 0, car: 0, month: "2026-01", previousBike: 10, previousCar: 20, previousTotal: 30, total: 0 },
      { bike: 0, car: 30, month: "2026-02", previousBike: 0, previousCar: 0, previousTotal: 0, total: 30 },
      { bike: 40, car: 50, month: "2026-03", previousBike: 0, previousCar: 0, previousTotal: 0, total: 90 },
    ],
  });
});

it("keeps an unconfigured vehicle at zero", () => {
  expect(buildGasTrend(["2026-02"], [{ amount: 25, kind: "car", occurredOn: "2026-02-01" }]).months).toEqual([
    { bike: 0, car: 25, month: "2026-02", previousBike: 0, previousCar: 0, previousTotal: 0, total: 25 },
  ]);
});
