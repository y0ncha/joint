import type { DateRange } from "@/lib/date-range";
import { previousMonth } from "@/lib/date-range";
import { getCurrentHouseholdContext } from "@/lib/household";

import {
  calculateBudgetProgress,
  calculateGoalProgress,
  sortGoalUrgency,
  type BudgetProgress,
  type BudgetTargetKind,
  type GoalProgress,
} from "./budgets-goals";

const LOAD_ERROR = "Unable to load budgets and goals.";

export type BudgetsGoalsReadOptions = {
  month?: string;
  range?: DateRange;
  today?: string;
};

type BudgetTargetBase = {
  id: string;
  label: string;
  monthlyBudget: number | null;
  name: string;
};

export type BudgetTarget = BudgetTargetBase & {
  targetKind: "category";
};

export type SubcategoryBudgetTarget = BudgetTargetBase & {
  categoryId: string;
  categoryName: string;
  targetKind: "subcategory";
};

export type BudgetRow = {
  categoryId?: string;
  categoryName?: string;
  id: string;
  label: string;
  monthlyBudget: number;
  name: string;
  progress: BudgetProgress;
  spent: number;
  targetKind: BudgetTargetKind;
};

export type GoalRow = {
  id: string;
  label: string;
  name: string;
  progress: GoalProgress;
  savedAmount: number;
  targetAmount: number;
  targetDate: string;
};

export type BudgetsGoalsData = {
  budgets: BudgetRow[];
  goals: GoalRow[];
  targets: {
    categories: BudgetTarget[];
    subcategories: SubcategoryBudgetTarget[];
  };
};

function finiteAmount(value: number | string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Invalid monetary value from the database.");
  return amount;
}

function compareText(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function spendingRpcArgs(month: string, range: DateRange | undefined, subcategories: boolean) {
  return {
    p_month: `${month}-01`,
    ...(range ? { p_range_from: range.from, p_range_to: range.to } : {}),
    p_subcategories: subcategories,
  };
}

export async function getBudgetsGoalsData(options: BudgetsGoalsReadOptions = {}): Promise<BudgetsGoalsData> {
  try {
    const household = await getCurrentHouseholdContext();
    if (household.status !== "member") throw new Error("No household membership.");

    const month = options.month ?? previousMonth();
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    const [categoriesResult, subcategoriesResult, goalsResult, parentSpendingResult, childSpendingResult] = await Promise.all([
      household.supabase
        .from("categories")
        .select("id, name, kind, system_key, archived_at, monthly_budget")
        .eq("household_id", household.householdId)
        .order("name"),
      household.supabase
        .from("subcategories")
        .select("id, name, category_id, archived_at, monthly_budget")
        .eq("household_id", household.householdId)
        .order("name"),
      household.supabase
        .from("savings_goals")
        .select("id, name, target_amount, saved_amount, target_date")
        .eq("household_id", household.householdId),
      household.supabase.rpc("dashboard_spending_breakdown", spendingRpcArgs(month, options.range, false)),
      household.supabase.rpc("dashboard_spending_breakdown", spendingRpcArgs(month, options.range, true)),
    ]);

    if (
      categoriesResult.error ||
      subcategoriesResult.error ||
      goalsResult.error ||
      parentSpendingResult.error ||
      childSpendingResult.error ||
      categoriesResult.data === null ||
      subcategoriesResult.data === null ||
      goalsResult.data === null ||
      parentSpendingResult.data === null ||
      childSpendingResult.data === null
    ) {
      throw new Error("Budget or goal read failed.");
    }

    const categories = categoriesResult.data.filter((category) => category.kind === "expense" && category.archived_at === null);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const categoryTargets = categories
      .map<BudgetTarget>((category) => ({
        id: category.id,
        label: category.name,
        monthlyBudget: category.monthly_budget === null ? null : finiteAmount(category.monthly_budget),
        name: category.name,
        targetKind: "category",
      }))
      .sort((left, right) => compareText(left.label, right.label) || compareText(left.id, right.id));
    const subcategoryTargets = subcategoriesResult.data
      .flatMap<SubcategoryBudgetTarget>((subcategory) => {
        const category = categoriesById.get(subcategory.category_id);
        if (!category || subcategory.archived_at !== null) return [];
        return [
          {
            categoryId: category.id,
            categoryName: category.name,
            id: subcategory.id,
            label: `${category.name} · ${subcategory.name}`,
            monthlyBudget: subcategory.monthly_budget === null ? null : finiteAmount(subcategory.monthly_budget),
            name: subcategory.name,
            targetKind: "subcategory",
          },
        ];
      })
      .sort((left, right) => compareText(left.label, right.label) || compareText(left.id, right.id));

    const parentSpending = new Map(parentSpendingResult.data.map((row) => [row.category_id, finiteAmount(row.amount)]));
    const childSpending = new Map(childSpendingResult.data.map((row) => [row.category_id, finiteAmount(row.amount)]));
    const budgets = [...categoryTargets, ...subcategoryTargets]
      .filter((target): target is (BudgetTarget | SubcategoryBudgetTarget) & { monthlyBudget: number } => target.monthlyBudget !== null)
      .map((target) => {
        const subcategory = "categoryId" in target;
        const spent = subcategory ? (childSpending.get(target.id) ?? 0) : (parentSpending.get(target.id) ?? 0);
        const progress = calculateBudgetProgress({ spent, monthlyBudget: target.monthlyBudget });
        return {
          ...(subcategory ? { categoryId: target.categoryId, categoryName: target.categoryName } : {}),
          id: target.id,
          label: target.label,
          monthlyBudget: target.monthlyBudget,
          name: target.name,
          progress,
          spent,
          targetKind: target.targetKind,
        };
      })
      .sort((left, right) => compareText(left.label, right.label) || compareText(left.id, right.id));

    const goalInputs = goalsResult.data.map((goal) => {
      const targetAmount = finiteAmount(goal.target_amount);
      const savedAmount = finiteAmount(goal.saved_amount);
      return { id: goal.id, label: goal.name, name: goal.name, savedAmount, targetAmount, targetDate: goal.target_date };
    });
    const goals = sortGoalUrgency(goalInputs, today).map((goal) => ({
      ...goal,
      progress: calculateGoalProgress(goal, today),
    }));

    return { budgets, goals, targets: { categories: categoryTargets, subcategories: subcategoryTargets } };
  } catch {
    throw new Error(LOAD_ERROR);
  }
}
