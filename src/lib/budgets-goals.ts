import { z } from "zod";

import { isCanonicalIsoDate } from "./date-range";

const MAX_AMOUNT = 10_000_000_000;

function hasAtMostTwoDecimalPlaces(value: number) {
  return Number(value.toFixed(2)) === value;
}

const money = (message: string, minimum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? Number.NaN : value),
    z.coerce
      .number()
      .finite("Enter a finite amount.")
      .gte(minimum, message)
      .lt(MAX_AMOUNT, "Enter an amount below 10000000000.")
      .refine(hasAtMostTwoDecimalPlaces, "Use no more than two decimal places."),
  );

export const targetKindSchema = z.enum(["category", "subcategory"]);
export const targetIdSchema = z.string().uuid("Choose a valid target.");
export const monthlyBudgetSchema = money("Enter an amount greater than zero.", Number.MIN_VALUE);
export const goalNameSchema = z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer.");
export const targetAmountSchema = money("Enter an amount greater than zero.", Number.MIN_VALUE);
export const savedAmountSchema = money("Enter zero or a positive amount.", 0);
export const targetDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine(isCanonicalIsoDate, "Use YYYY-MM-DD.");

export const budgetInputSchema = z.object({
  targetKind: targetKindSchema,
  targetId: targetIdSchema,
  monthlyBudget: monthlyBudgetSchema,
});

export const goalInputSchema = z.object({
  name: goalNameSchema,
  targetAmount: targetAmountSchema,
  savedAmount: savedAmountSchema,
  targetDate: targetDateSchema,
});

export type BudgetTargetKind = z.infer<typeof targetKindSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
export type GoalInput = z.infer<typeof goalInputSchema>;

export type BudgetProgress = {
  spentAgorot: number;
  budgetAgorot: number;
  percentage: number;
  barPercentage: number;
  remainingAgorot: number;
  overBudgetAgorot: number;
};

export type GoalProgress = {
  targetAgorot: number;
  savedAgorot: number;
  percentage: number;
  barPercentage: number;
  remainingAgorot: number;
  monthlyRequiredAgorot: number | null;
  remainingMonths: number | null;
  status: "active" | "overdue" | "complete";
};

export type BudgetUrgencyInput = {
  id: string;
  label: string;
  spent: number;
  monthlyBudget: number;
};

export type GoalUrgencyInput = {
  id: string;
  label: string;
  targetDate: string;
  targetAmount: number;
  savedAmount: number;
};

function toAgorot(value: number) {
  return Math.round(value * 100);
}

function compareText(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function calculateBudgetProgress({ spent, monthlyBudget }: Pick<BudgetUrgencyInput, "spent" | "monthlyBudget">): BudgetProgress {
  const spentAgorot = toAgorot(spent);
  const budgetAgorot = toAgorot(monthlyBudget);
  const difference = budgetAgorot - spentAgorot;

  return {
    spentAgorot,
    budgetAgorot,
    percentage: (spentAgorot / budgetAgorot) * 100,
    barPercentage: Math.min(100, Math.max(0, (spentAgorot / budgetAgorot) * 100)),
    remainingAgorot: Math.max(difference, 0),
    overBudgetAgorot: Math.max(-difference, 0),
  };
}

export function calculateGoalProgress(
  input: Pick<GoalUrgencyInput, "targetAmount" | "savedAmount" | "targetDate">,
  today: string,
): GoalProgress {
  if (!isCanonicalIsoDate(today)) throw new Error("Invalid ISO date: today");

  const targetAgorot = toAgorot(input.targetAmount);
  const savedAgorot = toAgorot(input.savedAmount);
  const remainingAgorot = Math.max(targetAgorot - savedAgorot, 0);
  const percentage = (savedAgorot / targetAgorot) * 100;
  const complete = savedAgorot >= targetAgorot;
  const overdue = !complete && input.targetDate < today;
  const calendarMonths =
    (Number(input.targetDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    Number(input.targetDate.slice(5, 7)) -
    Number(today.slice(5, 7));
  const remainingMonths = complete || overdue ? null : Math.max(calendarMonths, 1);

  return {
    targetAgorot,
    savedAgorot,
    percentage,
    barPercentage: Math.min(100, Math.max(0, percentage)),
    remainingAgorot,
    monthlyRequiredAgorot: complete ? 0 : overdue ? null : Math.ceil(remainingAgorot / (remainingMonths ?? 1)),
    remainingMonths,
    status: complete ? "complete" : overdue ? "overdue" : "active",
  };
}

export function sortBudgetUrgency<T extends BudgetUrgencyInput>(rows: readonly T[]) {
  return [...rows].sort((left, right) => {
    const ratioDifference = calculateBudgetProgress(right).percentage - calculateBudgetProgress(left).percentage;
    return ratioDifference || compareText(left.label, right.label) || compareText(left.id, right.id);
  });
}

export function sortGoalUrgency<T extends GoalUrgencyInput>(rows: readonly T[], today: string) {
  return [...rows].sort((left, right) => {
    const leftProgress = calculateGoalProgress(left, today);
    const rightProgress = calculateGoalProgress(right, today);
    const statusDifference = Number(leftProgress.status === "complete") - Number(rightProgress.status === "complete");
    return (
      statusDifference ||
      compareText(left.targetDate, right.targetDate) ||
      compareText(left.label, right.label) ||
      compareText(left.id, right.id)
    );
  });
}
