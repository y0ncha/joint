import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionState: null as unknown,
  actionReducers: [] as Array<(state: unknown, formData: FormData) => unknown>,
  pending: false,
  pillSelectProps: [] as Array<Record<string, unknown>>,
  runEffects: false,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: (state: unknown, formData: FormData) => unknown) => {
      mocks.actionReducers.push(action);
      return [mocks.actionState, () => {}, mocks.pending] as const;
    },
    useEffect: (effect: () => void, dependencies: readonly unknown[]) =>
      mocks.runEffects ? effect() : actual.useEffect(effect, dependencies),
  };
});
vi.mock("@/app/actions/budgets-goals", () => ({
  createSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
  removeMonthlyBudget: vi.fn(),
  saveMonthlyBudget: vi.fn(),
  updateSavingsGoal: vi.fn(),
}));
vi.mock("@/components/pill-select", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/pill-select")>();
  return {
    ...actual,
    PillSelect: (props: React.ComponentProps<typeof actual.PillSelect>) => {
      mocks.pillSelectProps.push(props);
      return <actual.PillSelect {...props} />;
    },
  };
});
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div data-sheet>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div data-sheet-content>{children}</div>,
  SheetDescription: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"p">) => <p {...props}>{children}</p>,
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
  AlertDialogDescription: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<"p">) => <p {...props}>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <div data-alert-dialog-trigger>{children}</div>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value }: { children: ReactNode; value?: string }) => <div data-select={value}>{children}</div>,
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
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

const workspaceModule = await import("./budgets-goals-workspace");
const actionsModule = await import("@/app/actions/budgets-goals");

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
        color: "#ccebef",
        id: "55555555-5555-4555-8555-555555555555",
        label: "Home",
        name: "Home",
        monthlyBudget: null,
        targetKind: "category" as const,
      },
    ],
    subcategories: [
      {
        color: "#d9f0fa",
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
  mocks.actionReducers.length = 0;
  mocks.pending = false;
  mocks.pillSelectProps.length = 0;
  mocks.runEffects = false;
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();

  vi.mocked(actionsModule.createSavingsGoal).mockReset();
  vi.mocked(actionsModule.deleteSavingsGoal).mockReset();
  vi.mocked(actionsModule.removeMonthlyBudget).mockReset();
  vi.mocked(actionsModule.saveMonthlyBudget).mockReset();
  vi.mocked(actionsModule.updateSavingsGoal).mockReset();
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

it("keeps empty copy inside each section and submits target identifiers", () => {
  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace {...data} budgets={[]} goals={[]} />);

  expect(markup).toContain("No monthly budgets configured yet.");
  expect(markup).toContain("No savings goals configured yet.");
  expect(markup).toContain('name="targetKind"');
  expect(markup).toContain('name="targetId"');
});

it("groups budget targets by category like the expense selector", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: {},
    data: { targetKind: "category", targetId: "55555555-5555-4555-8555-555555555555" },
  };
  const markup = renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" targets={data.targets} onSuccess={() => {}} />);
  const targetSelector = mocks.pillSelectProps.find((props) => props.ariaLabel === "Budget target");

  expect(markup).toContain('aria-label="Budget target"');
  expect(markup).toContain('type="button"');
  expect(markup).toContain("background-color:#ccebef");
  expect(targetSelector).toMatchObject({
    grouped: true,
    options: [
      {
        value: "category:55555555-5555-4555-8555-555555555555",
        label: "Home",
        section: { id: "55555555-5555-4555-8555-555555555555", label: "Home" },
      },
      {
        value: "subcategory:66666666-6666-4666-8666-666666666666",
        label: "Rent",
        section: { id: "55555555-5555-4555-8555-555555555555", label: "Home" },
      },
    ],
  });
});

it("uses rounded primary add controls and labelled icon-only row actions", () => {
  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace {...data} />);
  const budgetRowMarkup = renderToStaticMarkup(<workspaceModule.BudgetProgressRow row={data.budgets[0]} targets={data.targets} />);
  const goalRowMarkup = renderToStaticMarkup(<workspaceModule.GoalProgressRow goal={data.goals[0]} />);

  expect(markup).toMatch(/<button(?=[^>]*aria-label="Add budget")(?=[^>]*data-size="icon")(?=[^>]*rounded-full)/);
  expect(markup).toMatch(/<button(?=[^>]*aria-label="Add goal")(?=[^>]*data-size="icon")(?=[^>]*rounded-full)/);
  expect(budgetRowMarkup).toMatch(/<button(?=[^>]*aria-label="Edit Food budget")(?=[^>]*data-size="icon")/);
  expect(budgetRowMarkup).toMatch(/<button(?=[^>]*aria-label="Remove Food budget")(?=[^>]*data-size="icon")/);
  expect(goalRowMarkup).toMatch(/<button(?=[^>]*aria-label="Edit Emergency fund")(?=[^>]*data-size="icon")/);
  expect(goalRowMarkup).toMatch(/<button(?=[^>]*aria-label="Delete Emergency fund")(?=[^>]*data-size="icon")/);
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

it("wires budget target kind and id as separate hidden inputs", () => {
  const markup = renderToStaticMarkup(
    <workspaceModule.BudgetForm mode="edit" onSuccess={() => {}} target={data.budgets[0]} targets={data.targets} />,
  );

  expect(markup).toContain('<input type="hidden" name="targetKind" value="category"');
  expect(markup).toContain('<input type="hidden" name="targetId" value="11111111-1111-4111-8111-111111111111"');
  expect(markup).toContain('name="monthlyBudget"');
});

it("submits budget and goal forms through their FormData actions and preserves error values", async () => {
  const budgetError = {
    status: "error",
    formError: "Check the budget details.",
    fieldErrors: { monthlyBudget: "Enter an amount greater than zero." },
  } as const;
  const budgetTarget = data.budgets[0];
  vi.mocked(actionsModule.saveMonthlyBudget).mockResolvedValue(budgetError);

  renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" onSuccess={() => {}} targets={data.targets} />);
  const budgetInput = new FormData();
  budgetInput.set("targetKind", budgetTarget.targetKind);
  budgetInput.set("targetId", budgetTarget.id);
  budgetInput.set("monthlyBudget", "123.45");
  const budgetActionResult = await mocks.actionReducers[0](null, budgetInput);
  expect(budgetActionResult).toEqual({
    ...budgetError,
    data: { targetKind: "category", targetId: budgetTarget.id, monthlyBudget: "123.45" },
  });
  expect(actionsModule.saveMonthlyBudget).toHaveBeenCalledWith(null, budgetInput);

  mocks.actionState = budgetActionResult;
  const budgetErrorMarkup = renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" onSuccess={() => {}} targets={data.targets} />);
  expect(budgetErrorMarkup).toContain('name="targetKind" value="category"');
  expect(budgetErrorMarkup).toContain('name="targetId" value="11111111-1111-4111-8111-111111111111"');
  expect(budgetErrorMarkup).toContain('name="monthlyBudget" value="123.45"');
  expect(budgetErrorMarkup).toContain('aria-label="Budget target"');
  expect(budgetErrorMarkup).toContain("Enter an amount greater than zero.");

  mocks.actionState = null;
  mocks.actionReducers.length = 0;
  const createResult = {
    status: "error",
    formError: "Check the goal details.",
    fieldErrors: { name: "Enter a name." },
  } as const;
  vi.mocked(actionsModule.createSavingsGoal).mockResolvedValue(createResult);
  renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={() => {}} />);
  const createInput = new FormData();
  createInput.set("name", "Emergency fund");
  createInput.set("targetAmount", "275");
  createInput.set("savedAmount", "125");
  createInput.set("targetDate", "2027-06-30");
  const createActionResult = await mocks.actionReducers[0](null, createInput);
  expect(createActionResult).toEqual({
    ...createResult,
    data: { name: "Emergency fund", targetAmount: "275", savedAmount: "125", targetDate: "2027-06-30" },
  });
  expect(actionsModule.createSavingsGoal).toHaveBeenCalledWith(null, createInput);

  mocks.actionState = createActionResult;
  const createErrorMarkup = renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={() => {}} />);
  expect(createErrorMarkup).toContain('name="name" value="Emergency fund"');
  expect(createErrorMarkup).toContain('name="targetAmount" value="275"');
  expect(createErrorMarkup).toContain('name="savedAmount" value="125"');
  expect(createErrorMarkup).toContain('name="targetDate" value="2027-06-30"');
  expect(createErrorMarkup).toContain("Enter a name.");

  mocks.actionState = null;
  mocks.actionReducers.length = 0;
  const enteredGoal = data.goals[0];
  const updateError = {
    status: "error",
    formError: "Check the goal details.",
    fieldErrors: { name: "Enter a name." },
  } as const;
  vi.mocked(actionsModule.updateSavingsGoal).mockResolvedValue(updateError);
  renderToStaticMarkup(<workspaceModule.GoalForm goal={enteredGoal} mode="edit" onSuccess={() => {}} />);
  const updateInput = new FormData();
  updateInput.set("name", "Entered emergency fund");
  updateInput.set("targetAmount", "275");
  updateInput.set("savedAmount", "125");
  updateInput.set("targetDate", "2027-06-30");
  const updateActionResult = await mocks.actionReducers[0](null, updateInput);
  expect(updateActionResult).toEqual({
    ...updateError,
    data: { name: "Entered emergency fund", targetAmount: "275", savedAmount: "125", targetDate: "2027-06-30" },
  });
  expect(actionsModule.updateSavingsGoal).toHaveBeenCalledWith(enteredGoal.id, null, updateInput);

  mocks.actionState = updateActionResult;
  const goalErrorMarkup = renderToStaticMarkup(<workspaceModule.GoalForm goal={enteredGoal} mode="edit" onSuccess={() => {}} />);
  expect(goalErrorMarkup).toContain('name="name" value="Entered emergency fund"');
  expect(goalErrorMarkup).toContain('name="targetAmount" value="275"');
  expect(goalErrorMarkup).toContain('name="savedAmount" value="125"');
  expect(goalErrorMarkup).toContain('name="targetDate" value="2027-06-30"');
  expect(goalErrorMarkup).toContain("Enter a name.");
});

it("wraps long names in interpolated Sheet and confirmation descriptions", () => {
  const longBudget = { ...data.budgets[0], label: "A very long budget target name ".repeat(8) };
  const longGoal = { ...data.goals[0], name: "A very long savings goal name ".repeat(8) };
  const budgetMarkup = renderToStaticMarkup(<workspaceModule.BudgetProgressRow row={longBudget} targets={data.targets} />);
  const goalMarkup = renderToStaticMarkup(<workspaceModule.GoalProgressRow goal={longGoal} />);

  expect(budgetMarkup).toContain('class="min-w-0 break-words">Update the monthly limit for');
  expect(budgetMarkup).toContain('class="min-w-0 break-words">This clears the monthly limit for');
  expect(goalMarkup).toContain('class="min-w-0 break-words">This removes');
});

it("previews active, complete, overdue, and incomplete goal calculations", () => {
  const activeGoal = { ...data.goals[0], targetAmount: 100, savedAmount: 10, targetDate: "2099-12-31" };
  const completeGoal = { ...data.goals[0], targetAmount: 100, savedAmount: 100, targetDate: "2000-01-01" };
  const overdueGoal = { ...data.goals[0], targetAmount: 100, savedAmount: 10, targetDate: "2000-01-01" };

  expect(renderToStaticMarkup(<workspaceModule.GoalForm goal={activeGoal} mode="edit" onSuccess={() => {}} />)).toContain(
    "Monthly required: ₪",
  );
  expect(renderToStaticMarkup(<workspaceModule.GoalForm goal={completeGoal} mode="edit" onSuccess={() => {}} />)).toContain(
    "Monthly required: ₪0.00 · Complete",
  );
  expect(renderToStaticMarkup(<workspaceModule.GoalForm goal={overdueGoal} mode="edit" onSuccess={() => {}} />)).toContain(
    "Overdue · Monthly required is unavailable",
  );
  expect(renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={() => {}} />)).toContain(
    "Enter a valid target, saved amount, and needed-by date to preview monthly saving.",
  );
});

it("announces and disables each pending mutation", () => {
  mocks.pending = true;
  const budgetMarkup = renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" onSuccess={() => {}} targets={data.targets} />);
  expect(budgetMarkup).toContain('role="status"');
  expect(budgetMarkup).toContain("Saving budget…");
  expect(budgetMarkup).toContain('disabled=""');

  const goalMarkup = renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={() => {}} />);
  expect(goalMarkup).toContain("Saving goal…");
  expect(goalMarkup).toContain('disabled=""');

  const budgetRowMarkup = renderToStaticMarkup(<workspaceModule.BudgetProgressRow row={data.budgets[0]} targets={data.targets} />);
  expect(budgetRowMarkup).toContain("Removing budget…");
  expect(budgetRowMarkup).toContain('aria-label="Remove Food budget"');
  expect(budgetRowMarkup).toContain("disabled");

  const goalRowMarkup = renderToStaticMarkup(<workspaceModule.GoalProgressRow goal={data.goals[0]} />);
  expect(goalRowMarkup).toContain("Deleting goal…");
  expect(goalRowMarkup).toContain('aria-label="Delete Emergency fund"');
  expect(goalRowMarkup).toContain("disabled");
});

it("announces successful saves before invoking the Sheet close callback", () => {
  mocks.actionState = { status: "success" };
  mocks.runEffects = true;
  const budgetEvents: string[] = [];
  mocks.toastSuccess.mockImplementation(() => budgetEvents.push("feedback"));
  const onBudgetSuccess = vi.fn(() => budgetEvents.push("close"));
  renderToStaticMarkup(<workspaceModule.BudgetForm mode="add" onSuccess={onBudgetSuccess} targets={data.targets} />);

  expect(mocks.toastSuccess).toHaveBeenCalledWith("Budget saved", { id: "budget-save" });
  expect(onBudgetSuccess).toHaveBeenCalledOnce();
  expect(budgetEvents).toEqual(["feedback", "close"]);

  mocks.toastSuccess.mockReset();
  const goalEvents: string[] = [];
  mocks.toastSuccess.mockImplementation(() => goalEvents.push("feedback"));
  const onGoalSuccess = vi.fn(() => goalEvents.push("close"));
  renderToStaticMarkup(<workspaceModule.GoalForm mode="add" onSuccess={onGoalSuccess} />);

  expect(mocks.toastSuccess).toHaveBeenCalledWith("Goal saved", { id: "goal-save" });
  expect(onGoalSuccess).toHaveBeenCalledOnce();
  expect(goalEvents).toEqual(["feedback", "close"]);
});

it("preserves edited values alongside adjacent errors", () => {
  mocks.actionState = {
    status: "error",
    formError: "Check the form details.",
    fieldErrors: { name: "Enter a name.", targetAmount: "Enter an amount greater than zero.", targetDate: "Choose a date." },
  };
  const markup = renderToStaticMarkup(<workspaceModule.GoalForm goal={data.goals[0]} mode="edit" onSuccess={() => {}} />);

  expect(markup).toContain('name="name" value="Emergency fund"');
  expect(markup).toContain('name="targetAmount" value="100"');
  expect(markup).toContain('name="savedAmount" value="50"');
  expect(markup).toContain('name="targetDate" value="2026-12-31"');
  expect(markup).toContain("Enter a name.");
  expect(markup).toContain('aria-describedby="goal-33333333-3333-4333-8333-333333333333-name-error"');
});

it("keeps remove and delete behind confirmation and submits their action payloads", async () => {
  const budgetMarkup = renderToStaticMarkup(<workspaceModule.BudgetProgressRow row={data.budgets[0]} targets={data.targets} />);
  expect(budgetMarkup).toContain('role="alertdialog"');
  expect(budgetMarkup).toContain('<input type="hidden" name="targetKind" value="category"');
  expect(budgetMarkup).toContain('<input type="hidden" name="targetId" value="11111111-1111-4111-8111-111111111111"');
  expect(mocks.actionReducers).toHaveLength(2);

  const removeInput = new FormData();
  removeInput.set("targetKind", "category");
  removeInput.set("targetId", data.budgets[0].id);
  mocks.actionState = null;
  const removeResult = { status: "success" } as const;
  const { removeMonthlyBudget } = await import("@/app/actions/budgets-goals");
  vi.mocked(removeMonthlyBudget).mockResolvedValue(removeResult);
  await expect(mocks.actionReducers[1](null, removeInput)).resolves.toEqual(removeResult);
  expect(removeMonthlyBudget).toHaveBeenCalledWith(null, removeInput);
  expect(mocks.toastSuccess).toHaveBeenCalledWith("Budget removed", { id: "budget-remove" });

  mocks.actionReducers.length = 0;
  const goalMarkup = renderToStaticMarkup(<workspaceModule.GoalProgressRow goal={data.goals[0]} />);
  expect(goalMarkup).toContain('role="alertdialog"');
  expect(mocks.actionReducers).toHaveLength(2);
  const deleteInput = new FormData();
  const deleteResult = { status: "success" } as const;
  const { deleteSavingsGoal } = await import("@/app/actions/budgets-goals");
  vi.mocked(deleteSavingsGoal).mockResolvedValue(deleteResult);
  await expect(mocks.actionReducers[1](null, deleteInput)).resolves.toEqual(deleteResult);
  expect(deleteSavingsGoal).toHaveBeenCalledWith(data.goals[0].id, null, deleteInput);
  expect(mocks.toastSuccess).toHaveBeenCalledWith("Goal deleted", { id: "goal-delete" });
});

it("disables Add budget with an accessible explanation when every target is already budgeted", () => {
  const targets = {
    categories: data.targets.categories.map((target) => ({ ...target, monthlyBudget: 100 })),
    subcategories: data.targets.subcategories.map((target) => ({ ...target, monthlyBudget: 100 })),
  };
  const markup = renderToStaticMarkup(<workspaceModule.BudgetsGoalsWorkspace budgets={[]} goals={[]} targets={targets} />);

  expect(markup).toContain('aria-describedby="budget-add-help"');
  expect(markup).toContain('id="budget-add-help"');
  expect(markup).toContain("All active expense targets already have budgets.");
  expect(markup).toContain("Add budget");
  expect(markup).toContain('disabled=""');
});
