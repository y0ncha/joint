import { describe, expect, it } from "vitest";

import {
  alignBillYearOverYear,
  allocateBillDaily,
  buildGroceriesDaily,
  buildGroceriesMonthly,
  buildMonthlyRange,
  consolidateBillsByMonth,
  parseBillsGroceriesUrlDefaults,
  pickDefaultBillSubcategory,
} from "@/lib/bills-groceries";

describe("allocateBillDaily", () => {
  it("allocates ₪100.00 evenly across the full inclusive period before clipping", () => {
    const bill = {
      amount: 100,
      subcategoryId: "electricity",
      servicePeriodStart: "2026-07-31",
      servicePeriodEnd: "2026-08-03",
    };

    expect(allocateBillDaily(bill)).toEqual([
      { date: "2026-07-31", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-01", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-02", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-03", subcategoryId: "electricity", agorot: 2500 },
    ]);
    expect(allocateBillDaily(bill, { from: "2026-08-01", to: "2026-08-31" })).toEqual([
      { date: "2026-08-01", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-02", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-03", subcategoryId: "electricity", agorot: 2500 },
    ]);
  });

  it("assigns uneven remainders to the earliest UTC dates across leap-year spans", () => {
    expect(
      allocateBillDaily({
        amount: 0.05,
        subcategoryId: "water",
        servicePeriodStart: "2026-01-01",
        servicePeriodEnd: "2026-01-03",
      }),
    ).toEqual([
      { date: "2026-01-01", subcategoryId: "water", agorot: 2 },
      { date: "2026-01-02", subcategoryId: "water", agorot: 2 },
      { date: "2026-01-03", subcategoryId: "water", agorot: 1 },
    ]);

    expect(
      allocateBillDaily({
        amount: 0.03,
        subcategoryId: "water",
        servicePeriodStart: "2024-02-28",
        servicePeriodEnd: "2024-03-01",
      }),
    ).toEqual([
      { date: "2024-02-28", subcategoryId: "water", agorot: 1 },
      { date: "2024-02-29", subcategoryId: "water", agorot: 1 },
      { date: "2024-03-01", subcategoryId: "water", agorot: 1 },
    ]);

    const leapYear = allocateBillDaily({
      amount: 3.66,
      subcategoryId: "water",
      servicePeriodStart: "2024-01-01",
      servicePeriodEnd: "2024-12-31",
    });
    expect(leapYear).toHaveLength(366);
    expect([leapYear[0], leapYear[59], leapYear[365]]).toEqual([
      { date: "2024-01-01", subcategoryId: "water", agorot: 1 },
      { date: "2024-02-29", subcategoryId: "water", agorot: 1 },
      { date: "2024-12-31", subcategoryId: "water", agorot: 1 },
    ]);
  });
});

describe("consolidateBillsByMonth", () => {
  it("consolidates multiple Bills allocations by subcategory and month without mutating them", () => {
    const allocations = [
      { date: "2026-08-01", subcategoryId: "water", agorot: 1000 },
      { date: "2026-07-31", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-08-01", subcategoryId: "electricity", agorot: 2500 },
      { date: "2026-07-15", subcategoryId: "electricity", agorot: 100 },
      { date: "2026-08-02", subcategoryId: "electricity", agorot: 2500 },
    ];
    const original = structuredClone(allocations);

    expect(consolidateBillsByMonth(allocations)).toEqual([
      { month: "2026-07", subcategoryId: "electricity", agorot: 2600 },
      { month: "2026-08", subcategoryId: "electricity", agorot: 5000 },
      { month: "2026-08", subcategoryId: "water", agorot: 1000 },
    ]);
    expect(allocations).toEqual(original);
  });
});

describe("buildMonthlyRange", () => {
  it("builds rolling and calendar windows around the current UTC month", () => {
    expect(buildMonthlyRange("rolling", "2026-07-31")).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    expect(buildMonthlyRange("calendar", "2026-07-31")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("keeps the rolling window ordered across a UTC year boundary", () => {
    expect(buildMonthlyRange("rolling", "2026-01-01").slice(0, 2)).toEqual(["2025-02", "2025-03"]);
    expect(buildMonthlyRange("rolling", "2026-01-01").at(-1)).toBe("2026-01");
  });

  it("keeps early-year months canonical and rejects rolling underflow", () => {
    expect(buildMonthlyRange("calendar", "0001-01-01").slice(0, 2)).toEqual(["0001-01", "0001-02"]);
    expect(() => buildMonthlyRange("rolling", "0000-01-01")).toThrow("Invalid ISO month: 0000-01");
  });
});

describe("alignBillYearOverYear", () => {
  it("aligns current and previous years while leaving missing prior values absent", () => {
    expect(
      alignBillYearOverYear(
        ["2026-01", "2026-02", "2026-03"],
        [
          { month: "2025-01", subcategoryId: "electricity", agorot: 2500 },
          { month: "2025-02", subcategoryId: "electricity", agorot: 2000 },
          { month: "2026-01", subcategoryId: "electricity", agorot: 3000 },
          { month: "2026-03", subcategoryId: "electricity", agorot: 5000 },
          { month: "2025-03", subcategoryId: "water", agorot: 9999 },
        ],
        "electricity",
      ),
    ).toEqual([
      { month: "2026-01", currentAgorot: 3000, previousAgorot: 2500 },
      { month: "2026-02", currentAgorot: 0, previousAgorot: 2000 },
      { month: "2026-03", currentAgorot: 5000 },
    ]);
  });
});

describe("pickDefaultBillSubcategory", () => {
  it("uses the greatest current-window total and breaks ties by case-insensitive name", () => {
    expect(
      pickDefaultBillSubcategory(
        ["2026-01", "2026-02"],
        [
          { id: "water", name: "water" },
          { id: "electricity", name: "Electricity" },
          { id: "internet", name: "Internet" },
        ],
        [
          { month: "2026-01", subcategoryId: "water", agorot: 5000 },
          { month: "2026-01", subcategoryId: "electricity", agorot: 2500 },
          { month: "2026-02", subcategoryId: "electricity", agorot: 2500 },
          { month: "2025-12", subcategoryId: "internet", agorot: 9999 },
        ],
      ),
    ).toBe("electricity");
  });
});

describe("buildGroceriesMonthly", () => {
  it("builds zero-filled posting-date stacks and keeps an absent budget absent", () => {
    expect(
      buildGroceriesMonthly(
        ["2026-06", "2026-07", "2026-08"],
        [
          { amount: 10.25, occurredOn: "2026-06-30", subcategoryKey: "main_run" },
          { amount: 100.01, occurredOn: "2026-07-01", subcategoryKey: "main_run" },
          { amount: 0.99, occurredOn: "2026-07-31", subcategoryKey: "main_run" },
          { amount: 25.5, occurredOn: "2026-07-15", subcategoryKey: "top_ups" },
          { amount: 999, occurredOn: "2026-05-31", subcategoryKey: "top_ups" },
        ],
        null,
      ),
    ).toEqual({
      budgetAgorot: null,
      months: [
        { month: "2026-06", mainRunAgorot: 1025, topUpsAgorot: 0 },
        { month: "2026-07", mainRunAgorot: 10100, topUpsAgorot: 2550 },
        { month: "2026-08", mainRunAgorot: 0, topUpsAgorot: 0 },
      ],
    });
  });
});

describe("buildGroceriesDaily", () => {
  it("includes every selected posting date and sums same-day Groceries by kind", () => {
    expect(
      buildGroceriesDaily({ from: "2026-07-01", to: "2026-07-03" }, [
        { amount: 10, occurredOn: "2026-07-01", subcategoryKey: "main_run" },
        { amount: 5.01, occurredOn: "2026-07-01", subcategoryKey: "main_run" },
        { amount: 2.5, occurredOn: "2026-07-01", subcategoryKey: "top_ups" },
        { amount: 1, occurredOn: "2026-07-03", subcategoryKey: "top_ups" },
        { amount: 999, occurredOn: "2026-06-30", subcategoryKey: "main_run" },
      ]),
    ).toEqual([
      { date: "2026-07-01", mainRunAgorot: 1501, topUpsAgorot: 250, totalAgorot: 1751 },
      { date: "2026-07-02", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
      { date: "2026-07-03", mainRunAgorot: 0, topUpsAgorot: 100, totalAgorot: 100 },
    ]);
  });

  it("zero-fills UTC leap days without transactions", () => {
    expect(buildGroceriesDaily({ from: "2024-02-28", to: "2024-03-01" }, [])).toEqual([
      { date: "2024-02-28", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
      { date: "2024-02-29", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
      { date: "2024-03-01", mainRunAgorot: 0, topUpsAgorot: 0, totalAgorot: 0 },
    ]);
  });
});

describe("parseBillsGroceriesUrlDefaults", () => {
  const bills = [
    { id: "electricity", name: "Electricity" },
    { id: "water", name: "Water" },
  ];

  it("retains valid selections and uses the selected Groceries month", () => {
    expect(
      parseBillsGroceriesUrlDefaults(
        new URLSearchParams(
          "period=calendar&bills=water,electricity&bill=water&groceryMonth=2026-06&groceryFrom=2026-07-03&groceryTo=2026-07-05",
        ),
        { bills, defaultBillId: "electricity", currentDate: "2026-07-31" },
      ),
    ).toEqual({
      period: "calendar",
      billIds: ["water", "electricity"],
      billId: "water",
      groceryRange: { from: "2026-06-01", to: "2026-06-30" },
    });

    expect(
      parseBillsGroceriesUrlDefaults(new URLSearchParams("groceryMonth=2024-02"), {
        bills,
        defaultBillId: "electricity",
        currentDate: "2026-07-31",
      }),
    ).toEqual({
      period: "rolling",
      billIds: ["electricity", "water"],
      billId: "electricity",
      groceryRange: { from: "2024-02-01", to: "2024-02-29" },
    });
  });

  it("falls invalid or empty values back to all Bills, the spend default, and the previous month", () => {
    expect(
      parseBillsGroceriesUrlDefaults(
        new URLSearchParams("period=year&bills=&bill=deleted&groceryMonth=2026-13&groceryFrom=2026-07-31&groceryTo=2026-07-01"),
        { bills, defaultBillId: "water", currentDate: "2026-07-31" },
      ),
    ).toEqual({
      period: "rolling",
      billIds: ["electricity", "water"],
      billId: "water",
      groceryRange: { from: "2026-06-01", to: "2026-06-30" },
    });

    expect(
      parseBillsGroceriesUrlDefaults(new URLSearchParams("groceryMonth=2026-06&groceryFrom=bad&groceryTo=2026-07-05"), {
        bills,
        defaultBillId: "water",
        currentDate: "2026-07-31",
      }).groceryRange,
    ).toEqual({ from: "2026-06-01", to: "2026-06-30" });

    expect(
      parseBillsGroceriesUrlDefaults(new URLSearchParams("groceryFrom=2026-06-30&groceryTo=2026-07-01"), {
        bills,
        defaultBillId: "water",
        currentDate: "2026-07-31",
      }).groceryRange,
    ).toEqual({ from: "2026-06-01", to: "2026-06-30" });

    expect(
      parseBillsGroceriesUrlDefaults(new URLSearchParams(), {
        bills,
        defaultBillId: "water",
        currentDate: "2024-02-29",
      }).groceryRange,
    ).toEqual({ from: "2024-01-01", to: "2024-01-31" });
  });
});
