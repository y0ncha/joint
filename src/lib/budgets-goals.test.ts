import { describe, expect, it } from "vitest";

import {
  budgetInputSchema,
  calculateBudgetProgress,
  calculateGoalProgress,
  goalInputSchema,
  sortBudgetUrgency,
  sortGoalUrgency,
} from "./budgets-goals";

describe("budgets and goals input schemas", () => {
  it("accepts valid budget and goal input", () => {
    expect(
      budgetInputSchema.parse({
        targetKind: "subcategory",
        targetId: "11111111-1111-4111-8111-111111111111",
        monthlyBudget: "1200.50",
      }),
    ).toEqual({
      targetKind: "subcategory",
      targetId: "11111111-1111-4111-8111-111111111111",
      monthlyBudget: 1200.5,
    });
    expect(
      goalInputSchema.parse({
        name: "Emergency fund",
        targetAmount: "5000.00",
        savedAmount: "125.25",
        targetDate: "2026-12-31",
      }),
    ).toEqual({ name: "Emergency fund", targetAmount: 5000, savedAmount: 125.25, targetDate: "2026-12-31" });
  });

  it.each([
    [{ targetKind: "other", targetId: "00000000-0000-0000-0000-000000000001", monthlyBudget: 1 }, "targetKind"],
    [{ targetKind: "category", targetId: "not-a-uuid", monthlyBudget: 1 }, "targetId"],
    [{ targetKind: "category", targetId: "11111111-1111-4111-8111-111111111111", monthlyBudget: 0 }, "monthlyBudget"],
    [{ targetKind: "category", targetId: "11111111-1111-4111-8111-111111111111", monthlyBudget: 1.001 }, "monthlyBudget"],
    [{ targetKind: "category", targetId: "11111111-1111-4111-8111-111111111111", monthlyBudget: Number.NaN }, "monthlyBudget"],
  ])("rejects invalid budget %j at %s", (input, field) => {
    const result = budgetInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 10_000_000_000])("rejects budget boundary %s", (monthlyBudget) => {
    const result = budgetInputSchema.safeParse({
      targetKind: "category",
      targetId: "11111111-1111-4111-8111-111111111111",
      monthlyBudget,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "monthlyBudget")).toBe(true);
  });

  it.each([
    [{ name: " ", targetAmount: 1, savedAmount: 0, targetDate: "2026-12-31" }, "name"],
    [{ name: "Goal", targetAmount: 0, savedAmount: 0, targetDate: "2026-12-31" }, "targetAmount"],
    [{ name: "Goal", targetAmount: 1, savedAmount: -1, targetDate: "2026-12-31" }, "savedAmount"],
    [{ name: "Goal", targetAmount: 1, savedAmount: 0, targetDate: "2026-02-30" }, "targetDate"],
    [{ name: "x".repeat(81), targetAmount: 1, savedAmount: 0, targetDate: "2026-12-31" }, "name"],
  ])("rejects invalid goal %j at %s", (input, field) => {
    const result = goalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 10_000_000_000])("rejects goal amount boundary %s", (amount) => {
    for (const field of ["targetAmount", "savedAmount"] as const) {
      const result = goalInputSchema.safeParse({
        name: "Goal",
        targetAmount: 1,
        savedAmount: 0,
        targetDate: "2026-12-31",
        [field]: amount,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });
});

describe("budget progress", () => {
  it("rounds values to agorot before calculating capped and uncapped progress", () => {
    expect(calculateBudgetProgress({ spent: 1.239, monthlyBudget: 1.0 })).toEqual({
      spentAgorot: 124,
      budgetAgorot: 100,
      percentage: 124,
      barPercentage: 100,
      remainingAgorot: 0,
      overBudgetAgorot: 24,
    });
  });

  it("reports zero spend without negative remaining or over-budget values", () => {
    expect(calculateBudgetProgress({ spent: 0, monthlyBudget: 100 })).toEqual({
      spentAgorot: 0,
      budgetAgorot: 10000,
      percentage: 0,
      barPercentage: 0,
      remainingAgorot: 10000,
      overBudgetAgorot: 0,
    });
  });
});

describe("goal progress", () => {
  it("calculates a future monthly requirement using calendar months", () => {
    expect(calculateGoalProgress({ targetAmount: 100, savedAmount: 10, targetDate: "2026-12-31" }, "2026-08-15")).toEqual({
      targetAgorot: 10000,
      savedAgorot: 1000,
      percentage: 10,
      barPercentage: 10,
      remainingAgorot: 9000,
      monthlyRequiredAgorot: 2250,
      remainingMonths: 4,
      status: "active",
    });
  });

  it("uses one month for same-month goals and rounds required saving up", () => {
    expect(calculateGoalProgress({ targetAmount: 1, savedAmount: 0, targetDate: "2026-08-31" }, "2026-08-01")).toMatchObject({
      monthlyRequiredAgorot: 100,
      remainingMonths: 1,
      status: "active",
    });
    expect(calculateGoalProgress({ targetAmount: 1, savedAmount: 0.99, targetDate: "2026-10-01" }, "2026-08-15")).toMatchObject({
      monthlyRequiredAgorot: 1,
      remainingMonths: 2,
    });
  });

  it.each([
    [{ targetAmount: 100, savedAmount: 100, targetDate: "2026-07-01" }, "complete"],
    [{ targetAmount: 100, savedAmount: 125, targetDate: "2026-12-01" }, "complete"],
    [{ targetAmount: 100, savedAmount: 10, targetDate: "2026-08-01" }, "overdue"],
  ])("handles completed, overfunded, and overdue goals", (input, status) => {
    const result = calculateGoalProgress(input, "2026-08-15");
    expect(result.status).toBe(status);
    if (status === "complete") expect(result.monthlyRequiredAgorot).toBe(0);
    if (status === "overdue") expect(result.monthlyRequiredAgorot).toBeNull();
  });
});

describe("deterministic urgency ordering", () => {
  it("sorts budgets by uncapped utilization, then label and id", () => {
    const rows = [
      { id: "2", label: "B", spent: 1, monthlyBudget: 2 },
      { id: "3", label: "A", spent: 1, monthlyBudget: 2 },
      { id: "1", label: "Z", spent: 2, monthlyBudget: 2 },
    ];
    expect(sortBudgetUrgency(rows).map((row) => row.id)).toEqual(["1", "3", "2"]);
  });

  it("places incomplete goals by date before completed goals and resolves ties", () => {
    const rows = [
      { id: "2", label: "B", targetDate: "2026-09-01", targetAmount: 1, savedAmount: 0 },
      { id: "3", label: "A", targetDate: "2026-09-01", targetAmount: 1, savedAmount: 0 },
      { id: "1", label: "A", targetDate: "2026-01-01", targetAmount: 1, savedAmount: 1 },
    ];
    expect(sortGoalUrgency(rows, "2026-08-15").map((row) => row.id)).toEqual(["3", "2", "1"]);
  });
});
