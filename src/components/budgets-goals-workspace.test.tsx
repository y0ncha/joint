import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: null as unknown,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [mocks.actionState, () => {}, false] as const,
  };
});
vi.mock("@/app/actions/budgets-goals", () => ({
  createSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
  removeMonthlyBudget: vi.fn(),
  saveMonthlyBudget: vi.fn(),
  updateSavingsGoal: vi.fn(),
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div data-sheet>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div data-sheet-content>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <div data-sheet-trigger>{children}</div>,
}));
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div data-alert-dialog>{children}</div>,
  AlertDialogAction: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div role="alertdialog">{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <div data-alert-dialog-trigger>{children}</div>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div data-select>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div data-select-content>{children}</div>,
  SelectGroup: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"div">) => (
    <div data-select-group {...props}>
      {children}
    </div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-select-item={value}>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));
vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, ...props }: React.ComponentProps<"div"> & { value?: number }) => <div data-progress-value={value} {...props} />,
}));

const workspaceModule = await import("./budgets-goals-workspace");

const data = {
  budgets: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      label: "Food",
      name: "Food",
      monthlyBudget: 100,
      spent: 125.5,
      targetKind: "category" as const,
      progress: {
        spentAgorot: 12550,
        budgetAgorot: 10000,
        percentage: 125.5,
        barPercentage: 100,
        remainingAgorot: 0,
        overBudgetAgorot: 2550,
      },
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      label: "Food · Groceries",
      name: "Groceries",
      monthlyBudget: 200,
      spent: 50,
      targetKind: "subcategory" as const,
      categoryId: "11111111-1111-4111-8111-111111111111",
      categoryName: "Food",
      progress: {
        spentAgorot: 5000,
        budgetAgorot: 20000,
        percentage: 25,
        barPercentage: 25,
        remainingAgorot: 15000,
        overBudgetAgorot: 0,
      },
    },
  ],
  goals: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      label: "Emergency fund",
      name: "Emergency fund",
      savedAmount: 50,
      targetAmount: 100,
      targetDate: "2026-12-31",
      progress: {
        targetAgorot: 10000,
        savedAgorot: 5000,
        percentage: 50,
        barPercentage: 50,
        remainingAgorot: 5000,
        monthlyRequiredAgorot: 1000,
        remainingMonths: 5,
        status: "active" as const,
      },
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      label: "Completed trip",
      name: "Completed trip",
      savedAmount: 100,
      targetAmount: 100,
      targetDate: "2026-01-01",
      progress: {
        targetAgorot: 10000,
        savedAgorot: 10000,
        percentage: 100,
        barPercentage: 100,
        remainingAgorot: 0,
        monthlyRequiredAgorot: 0,
        remainingMonths: null,
        status: "complete" as const,
      },
    },
  ],
  targets: {
    categories: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        label: "Home",
        name: "Home",
        monthlyBudget: null,
        targetKind: "category" as const,
      },
    ],
    subcategories: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        label: "Home · Rent",
        name: "Rent",
        categoryId: "55555555-5555-4555-8555-555555555555",
        categoryName: "Home",
        monthlyBudget: null,
        targetKind: "subcategory" as const,
      },
    ],
  },
};

beforeEach(() => {
  mocks.actionState = null;
});

it("renders budgets and goals together with labelled capped progress and supplied ordering", () => {
  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace {...data} />);

  expect(markup.match(/data-slot="card"/g)).toHaveLength(2);
  expect(markup).toContain("Budgets");
  expect(markup).toContain("Goals");
  expect(markup).toContain("Food");
  expect(markup).toContain("Food · Groceries");
  expect(markup).toContain("Category");
  expect(markup).toContain("Subcategory");
  expect(markup).toContain("₪125.50");
  expect(markup).toContain("₪100.00");
  expect(markup).toContain("126%");
  expect(markup).toContain("Over budget by");
  expect(markup).toContain("₪150.00 remaining");
  expect(markup).toContain("Emergency fund");
  expect(markup).toContain("₪50.00");
  expect(markup).toContain("₪100.00");
  expect(markup).toContain("50%");
  expect(markup).toContain("31/12/2026");
  expect(markup).toContain("Monthly required: ₪10.00");
  expect(markup).toContain("Completed trip");
  expect(markup).toContain("Complete");
  expect(markup.indexOf("Emergency fund")).toBeLessThan(markup.indexOf("Completed trip"));
  expect(markup).toContain('aria-label="Budget progress for Food: 126%"');
  expect(markup).toContain('aria-label="Goal progress for Emergency fund: 50%"');
  expect(markup).not.toContain("Tabs");
  expect(markup).not.toContain("ToggleGroup");
});

it("keeps empty copy inside each section and exposes grouped target choices", () => {
  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace {...data} budgets={[]} goals={[]} />);

  expect(markup).toContain("No monthly budgets configured yet.");
  expect(markup).toContain("No savings goals configured yet.");
  expect(markup.match(/data-select-group/g)).toHaveLength(2);
  expect(markup).toContain("Categories");
  expect(markup).toContain("Subcategories");
  expect(markup).toContain('name="targetKind"');
  expect(markup).toContain('name="targetId"');
});

it("renders adjacent invalid fields and confirmation gates for destructive actions", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: { targetId: "Choose an active expense target.", monthlyBudget: "Enter an amount greater than zero." },
  };
  const budgetForm = renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" targets={data.targets} onSuccess={() => {}} />);
  expect(budgetForm).toContain('data-invalid="true"');
  expect(budgetForm).toContain('aria-invalid="true"');
  expect(budgetForm).toContain("Choose an active expense target.");
  expect(budgetForm).toContain('aria-live="polite"');

  const goalForm = renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={() => {}} />);
  expect(goalForm).toContain('aria-live="polite"');
  expect(goalForm).toContain('type="date"');
  expect(goalForm).toContain("Name");
  expect(goalForm).toContain("Target amount");
  expect(goalForm).toContain("Saved amount");
  expect(goalForm).toContain("Needed by");

  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace {...data} />);
  expect(markup.match(/data-alert-dialog/g)?.length).toBeGreaterThanOrEqual(2);
  expect(markup).toContain("Remove this budget?");
  expect(markup).toContain("Delete this goal?");
});
